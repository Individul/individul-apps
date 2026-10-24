/**
 * Sarcinile, etichetele, comentariile și pașii — scrierile, pe D1.
 *
 * Ce făcea Postgres singur și se face acum aici, la fiecare scriere:
 * - regulile RLS din 0001–0010, prin `acl.ts`;
 * - `tasks_updated_at`, `tasks_completed_at` (0030) și garda
 *   `tasks_reassign_guard` (0002), prin `nextTaskRow`;
 * - jurnalul (`record_audit`, 0033), în același `batch` cu schimbarea —
 *   inclusiv pentru rândurile șterse în cascadă (pași, comentarii, etichete),
 *   pe care Postgres le jurnaliza și el, fiecare prin triggerul lui.
 */

import { and, eq, inArray, sql } from "drizzle-orm";

import {
  NEAUTENTIFICAT,
  canDeleteCommentRow,
  canDeleteTaskRow,
  canInsertComment,
  canInsertTask,
  canReassign,
  canUpdateComment,
  canUpdateTask,
  canWriteSubtasks,
  type Actor,
} from "@/lib/acl";
import {
  auditContext,
  auditInsert,
  commentAudit,
  subtaskAudit,
  tagAudit,
  taskAudit,
  taskTagAudit,
  type AuditContext,
  type AuditDraft,
} from "@/lib/audit";
import { isUniqueViolation, type Db } from "@/lib/db";
import { comments, subtasks, tags, taskTags, tasks } from "@/lib/db/schema";
import { hasChanges } from "@/lib/changes";
import { notify } from "@/lib/notify";
import { taskSchema, type TaskInput } from "@/lib/schemas";
import { isDispatchStep, isResponseStep, templateStepsForTags } from "@/lib/subtask-templates";
import { namesOf, runBatch, type ActionResult } from "./common";

export const STATUS_LABEL = {
  todo: "De făcut",
  in_progress: "În lucru",
  waiting: "În așteptare",
  done: "Finalizat",
} as const;

type TaskRow = typeof tasks.$inferSelect;
type Statement = Parameters<typeof runBatch>[1][number];

const FARA_DREPT_SARCINA = "Sarcină inexistentă sau fără permisiune.";

function normalize(input: TaskInput) {
  return {
    title: input.title.trim(),
    description: input.description ? input.description : null,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date ? input.due_date : null,
    assignee_id: input.assignee_id ? input.assignee_id : null,
    // Doar dacă a fost trimis. Un apel care nu știe de câmp (o schimbare de
    // stare dintr-un meniu, de pildă) ar fi scris altfel `false` și ar fi scos
    // semnul „Atacat la CSJ" de pe o sarcină fără ca cineva să fi atins bifa.
    // La creare, lipsa lui lasă valoarea implicită din bază, adică „nu".
    ...(input.appealed_csj === undefined ? {} : { appealed_csj: input.appealed_csj }),
  };
}

/**
 * De când așteaptă sarcina. Contorul pornește la intrarea în stare și se
 * păstrează cât timp rămâne acolo — altfel fiecare salvare l-ar reseta și
 * așteptările lungi ar arăta veșnic ca proaspete.
 */
function waitingSince(
  nextStatus: TaskInput["status"],
  at: string,
  prevStatus?: string,
  prevSince?: string | null,
): string | null {
  if (nextStatus !== "waiting") return null;
  if (prevStatus === "waiting" && prevSince) return prevSince;
  return at;
}

/**
 * Rândul de după o actualizare, cu ce puneau triggerele: `updated_at` mereu,
 * `completed_at` la intrarea în „Gata" și golit la ieșire (0030). Când starea
 * rămâne „Gata" de la un capăt la altul, data rămâne cum era — o corectură pusă
 * de mână pe `completed_at` rămâne acolo unde a pus-o omul.
 */
export function nextTaskRow(prev: TaskRow, patch: Partial<TaskRow>, at: string): TaskRow {
  const next: TaskRow = { ...prev, ...patch, updated_at: at };
  if (next.status === "done" && prev.status !== "done") next.completed_at = at;
  else if (next.status !== "done") next.completed_at = null;
  return next;
}

/**
 * Actualizarea unei sarcini, cu verificările pe care le făcea baza:
 * regula „tasks update" pe rândul de dinainte și pe cel de după, plus garda
 * de responsabil, cu mesajul ei de atunci.
 */
async function taskUpdate(
  db: Db,
  me: Actor,
  ctx: AuditContext,
  prev: TaskRow,
  patch: Partial<TaskRow>,
): Promise<{ next: TaskRow; statements: Statement[] } | { error: string }> {
  if (!canUpdateTask(me, prev)) return { error: FARA_DREPT_SARCINA };
  const next = nextTaskRow(prev, patch, ctx.at);
  if (next.assignee_id !== prev.assignee_id && !canReassign(me)) {
    return { error: "Doar adminul poate schimba responsabilul." };
  }
  if (!canUpdateTask(me, next)) return { error: FARA_DREPT_SARCINA };

  const { id: _id, created_at: _c, created_by: _b, ...values } = next;
  const nameOf = await namesOf(db, [prev.assignee_id, next.assignee_id]);
  return {
    next,
    statements: [
      db.update(tasks).set(values).where(eq(tasks.id, prev.id)),
      auditInsert(db, ctx, [taskAudit("UPDATE", prev, next, nameOf)]),
    ],
  };
}

async function getTaskRow(db: Db, id: string): Promise<TaskRow | undefined> {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

/** Pașii din șabloanele etichetelor date care lipsesc din `existing`. */
function templateRows(
  taskId: string,
  tagNames: string[],
  existing: { title: string; position: number }[],
) {
  const steps = templateStepsForTags(tagNames);
  const have = new Set(existing.map((s) => s.title));
  let position = existing.reduce((m, s) => Math.max(m, s.position), -1) + 1;
  return steps
    .filter((title) => !have.has(title))
    .map((title) => ({ id: crypto.randomUUID(), task_id: taskId, title, done: false, position: position++ }));
}

function subtaskInserts(db: Db, ctx: AuditContext, rows: ReturnType<typeof templateRows>): Statement[] {
  if (rows.length === 0) return [];
  const at = ctx.at;
  const full = rows.map((r) => ({ ...r, done_at: null, created_at: at }));
  return [
    db.insert(subtasks).values(full),
    auditInsert(db, ctx, full.map((r) => subtaskAudit("INSERT", null, r))),
  ];
}

/* ------------------------------------------------------------ sarcinile */

export async function createTask(
  db: Db,
  me: Actor | null,
  input: TaskInput,
  tagIds: string[] = [],
): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Date invalide." };
  if (!me) return { error: NEAUTENTIFICAT };

  const ctx = auditContext(me);
  const nt = normalize(parsed.data);
  if (!canInsertTask(me, { created_by: me.id, assignee_id: nt.assignee_id })) {
    return { error: "Doar adminul poate atribui o sarcină altcuiva." };
  }

  const row: TaskRow = {
    id: crypto.randomUUID(),
    ...nt,
    appealed_csj: nt.appealed_csj ?? false,
    waiting_since: waitingSince(nt.status, ctx.at),
    created_by: me.id,
    created_at: ctx.at,
    updated_at: ctx.at,
    // `tasks_completed_at` la inserare: născută „Gata", datată pe loc.
    completed_at: nt.status === "done" ? ctx.at : null,
  };

  const uniqueTags = [...new Set(tagIds)];
  const tagRows = uniqueTags.length
    ? await db.select({ id: tags.id, name: tags.name }).from(tags).where(inArray(tags.id, uniqueTags))
    : [];
  // Șabloane: pașii standard ai etichetelor alese intră odată cu sarcina.
  const steps = templateRows(row.id, tagRows.map((t) => t.name), []);
  const links = uniqueTags.map((tag_id) => ({ task_id: row.id, tag_id }));

  try {
    await runBatch(db, [
      db.insert(tasks).values(row),
      auditInsert(db, ctx, [taskAudit("INSERT", null, row, () => null)]),
      ...(links.length
        ? [db.insert(taskTags).values(links), auditInsert(db, ctx, links.map((l) => taskTagAudit("INSERT", l)))]
        : []),
      ...subtaskInserts(db, ctx, steps),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la crearea sarcinii." };
  }

  const created = { id: row.id, title: nt.title, assignee_id: nt.assignee_id, created_by: me.id };
  // Adminii află de orice sarcină nouă, chiar dacă autorul și-a atribuit-o singur.
  await notify(db, me, "created", created);
  if (nt.assignee_id) {
    // Adminii au primit deja „created" pentru aceeași acțiune — fără copie dublă.
    await notify(db, me, "assigned", created, undefined, false);
  }
  return { success: true };
}

export async function updateTask(
  db: Db,
  me: Actor | null,
  id: string,
  input: TaskInput,
  tagIds: string[] = [],
): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Date invalide." };
  if (!me) return { error: NEAUTENTIFICAT };

  // Rândul întreg: spune ce s-a schimbat și dacă s-a schimbat ceva.
  const prev = await getTaskRow(db, id);
  if (!prev) return { error: FARA_DREPT_SARCINA };

  const ctx = auditContext(me);
  const nt = normalize(parsed.data);
  const update = await taskUpdate(db, me, ctx, prev, {
    ...nt,
    waiting_since: waitingSince(nt.status, ctx.at, prev.status, prev.waiting_since),
  });
  if ("error" in update) return update;

  // Sincronizează etichetele (adaugă cele noi, elimină cele deselectate).
  const existing = await db.select({ tag_id: taskTags.tag_id }).from(taskTags).where(eq(taskTags.task_id, id));
  const current = new Set(existing.map((r) => r.tag_id));
  const wanted = [...new Set(tagIds)];
  const toAdd = wanted.filter((t) => !current.has(t)).map((tag_id) => ({ task_id: id, tag_id }));
  const toRemove = [...current].filter((t) => !wanted.includes(t)).map((tag_id) => ({ task_id: id, tag_id }));

  try {
    await runBatch(db, [
      ...update.statements,
      ...(toAdd.length
        ? [db.insert(taskTags).values(toAdd), auditInsert(db, ctx, toAdd.map((l) => taskTagAudit("INSERT", l)))]
        : []),
      ...(toRemove.length
        ? [
            db
              .delete(taskTags)
              .where(and(eq(taskTags.task_id, id), inArray(taskTags.tag_id, toRemove.map((l) => l.tag_id)))),
            auditInsert(db, ctx, toRemove.map((l) => taskTagAudit("DELETE", l))),
          ]
        : []),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvarea sarcinii." };
  }

  // Un „Salvează" care n-a schimbat nici câmpurile, nici etichetele, nu notifică.
  const touched = hasChanges(prev, nt) || toAdd.length > 0 || toRemove.length > 0;
  if (touched) {
    const task = { id, title: nt.title, assignee_id: nt.assignee_id, created_by: prev.created_by };
    if (nt.assignee_id && nt.assignee_id !== prev.assignee_id) await notify(db, me, "assigned", task);
    else if (nt.status !== prev.status) await notify(db, me, "status", task, STATUS_LABEL[nt.status]);
    else await notify(db, me, "edited", task);
  }
  return { success: true };
}

export async function deleteTask(db: Db, me: Actor | null, id: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await getTaskRow(db, id);
  if (!prev || !canDeleteTaskRow(me, prev)) return { error: FARA_DREPT_SARCINA };

  const ctx = auditContext(me);
  // Ce pleacă odată cu sarcina, prin `on delete cascade`. Postgres jurnaliza
  // fiecare rând șters așa, prin triggerul tabelului lui, înaintea sarcinii.
  const [steps, notes, links] = await db.batch([
    db.select().from(subtasks).where(eq(subtasks.task_id, id)),
    db.select().from(comments).where(eq(comments.task_id, id)),
    db.select().from(taskTags).where(eq(taskTags.task_id, id)),
  ]);
  const cascaded: AuditDraft[] = [
    ...notes.map((c) => commentAudit("DELETE", c)),
    ...steps.map((s) => subtaskAudit("DELETE", s, null)),
    ...links.map((l) => taskTagAudit("DELETE", l)),
  ];

  await runBatch(db, [
    db.delete(tasks).where(eq(tasks.id, id)),
    auditInsert(db, ctx, [...cascaded, taskAudit("DELETE", prev, null, () => null)]),
  ]);

  await notify(db, me, "deleted", {
    id,
    title: prev.title,
    assignee_id: prev.assignee_id,
    created_by: prev.created_by,
  });
  return { success: true };
}

/**
 * Pune sau scoate semnul „Atacat la CSJ".
 *
 * Acțiune proprie, nu prin `updateTask`: butonul din pagina sarcinii schimbă un
 * singur lucru, iar trimiterea întregului formular ar fi rescris și câmpurile
 * pe care omul nu le-a atins — cu ce avea pagina încărcată, poate de acum o oră.
 * Dreptul e al regulii „tasks update": admin, autorul sau responsabilul.
 */
export async function setTaskAppealedCsj(
  db: Db,
  me: Actor | null,
  id: string,
  appealed: boolean,
): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await getTaskRow(db, id);
  if (!prev) return { error: FARA_DREPT_SARCINA };
  const update = await taskUpdate(db, me, auditContext(me), prev, { appealed_csj: appealed });
  if ("error" in update) return update;
  await runBatch(db, update.statements);
  return { success: true };
}

/** Marchează sarcina ca finalizată — regula „proprie sau admin" a lui „tasks update". */
export async function finalizeTask(db: Db, me: Actor | null, id: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await getTaskRow(db, id);
  if (!prev) return { error: FARA_DREPT_SARCINA };
  const update = await taskUpdate(db, me, auditContext(me), prev, { status: "done", waiting_since: null });
  if ("error" in update) return update;
  await runBatch(db, update.statements);

  await notify(
    db,
    me,
    "status",
    { id, title: prev.title, assignee_id: prev.assignee_id, created_by: prev.created_by },
    "Finalizat",
  );
  return { success: true };
}

/* ------------------------------------------------------------ etichetele */

type TagResult = { error?: string; tag?: { id: string; name: string; color: string } };

export async function createTag(db: Db, me: Actor | null, name: string, color: string): Promise<TagResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Numele etichetei e obligatoriu." };
  if (!me) return { error: NEAUTENTIFICAT };
  // Doar adminul poate crea etichete (regula „tags insert admin").
  if (!me.isAdmin) return { error: "Doar adminul poate crea etichete." };

  const tag = { id: crypto.randomUUID(), name: trimmed, color };
  try {
    await runBatch(db, [db.insert(tags).values(tag), auditInsert(db, auditContext(me), [tagAudit("INSERT", tag)])]);
  } catch (e) {
    // Numele etichetelor sunt unice; ciocnirea e un caz așteptat, nu o eroare
    // de sistem — `updateTag` de mai jos o tratează la fel.
    if (isUniqueViolation(e)) return { error: "Există deja o etichetă cu numele acesta." };
    return { error: e instanceof Error ? e.message : "Eroare la crearea etichetei." };
  }
  return { tag };
}

export async function updateTag(
  db: Db,
  me: Actor | null,
  id: string,
  name: string,
  color: string,
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Numele etichetei e obligatoriu." };
  if (!me) return { error: NEAUTENTIFICAT };
  if (!me.isAdmin) return { error: "Doar adminul poate modifica etichete." };

  const prev = await db.select().from(tags).where(eq(tags.id, id)).get();
  if (!prev) return { error: "Etichetă inexistentă sau fără permisiune." };
  const next = { ...prev, name: trimmed, color };
  try {
    await runBatch(db, [
      db.update(tags).set({ name: trimmed, color }).where(eq(tags.id, id)),
      auditInsert(db, auditContext(me), [tagAudit("UPDATE", next)]),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Există deja o etichetă cu acest nume." };
    return { error: e instanceof Error ? e.message : "Eroare la salvarea etichetei." };
  }
  return { success: true };
}

export async function deleteTag(db: Db, me: Actor | null, id: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  if (!me.isAdmin) return { error: "Doar adminul poate șterge etichete." };

  const prev = await db.select().from(tags).where(eq(tags.id, id)).get();
  if (!prev) return { error: "Etichetă inexistentă sau fără permisiune." };
  // task_tags are ON DELETE CASCADE → eticheta se elimină automat de pe sarcini,
  // iar fiecare legătură ruptă intră în jurnal, cum o trecea și Postgres.
  const links = await db.select().from(taskTags).where(eq(taskTags.tag_id, id));
  await runBatch(db, [
    db.delete(tags).where(eq(tags.id, id)),
    auditInsert(db, auditContext(me), [...links.map((l) => taskTagAudit("DELETE", l)), tagAudit("DELETE", prev)]),
  ]);
  return { success: true };
}

/**
 * Leagă o etichetă de o sarcină. Regula „task_tags all authenticated": oricine
 * conectat, pe orice sarcină — așa era.
 */
export async function attachTag(db: Db, me: Actor | null, taskId: string, tagId: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const link = { task_id: taskId, tag_id: tagId };
  try {
    await runBatch(db, [db.insert(taskTags).values(link), auditInsert(db, auditContext(me), [taskTagAudit("INSERT", link)])]);
  } catch (e) {
    // Dublu-click pe aceeași etichetă = ciocnire pe cheia primară. Starea dorită
    // — eticheta atașată — există deja, deci e o reușită, nu o eroare de arătat.
    if (!isUniqueViolation(e)) return { error: e instanceof Error ? e.message : "Eroare la etichetare." };
  }
  return { success: true };
}

export async function detachTag(db: Db, me: Actor | null, taskId: string, tagId: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const where = and(eq(taskTags.task_id, taskId), eq(taskTags.tag_id, tagId));
  const existing = await db.select().from(taskTags).where(where);
  if (existing.length === 0) return { success: true };
  await runBatch(db, [
    db.delete(taskTags).where(where),
    auditInsert(db, auditContext(me), existing.map((l) => taskTagAudit("DELETE", l))),
  ]);
  return { success: true };
}

/* ------------------------------------------------------------ comentariile */

export async function addComment(db: Db, me: Actor | null, taskId: string, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Comentariul nu poate fi gol." };
  if (!me) return { error: NEAUTENTIFICAT };

  const task = await getTaskRow(db, taskId);
  if (!task) return { error: FARA_DREPT_SARCINA };
  const comment = { id: crypto.randomUUID(), task_id: taskId, author_id: me.id, body: trimmed };
  if (!canInsertComment(me, comment)) return { error: "Fără permisiune." };

  const ctx = auditContext(me);
  await runBatch(db, [
    db.insert(comments).values({ ...comment, created_at: ctx.at }),
    auditInsert(db, ctx, [commentAudit("INSERT", comment)]),
  ]);

  await notify(db, me, "comment", {
    id: taskId,
    title: task.title,
    assignee_id: task.assignee_id,
    created_by: task.created_by,
  });
  return { success: true };
}

export async function editComment(db: Db, me: Actor | null, commentId: string, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Comentariul nu poate fi gol." };
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await db.select().from(comments).where(eq(comments.id, commentId)).get();
  if (!prev || !canUpdateComment(me, prev)) return { error: "Comentariu inexistent sau fără permisiune." };
  await runBatch(db, [
    db.update(comments).set({ body: trimmed }).where(eq(comments.id, commentId)),
    auditInsert(db, auditContext(me), [commentAudit("UPDATE", prev)]),
  ]);
  return { success: true };
}

export async function deleteComment(db: Db, me: Actor | null, commentId: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await db.select().from(comments).where(eq(comments.id, commentId)).get();
  if (!prev || !canDeleteCommentRow(me, prev)) return { error: "Comentariu inexistent sau fără permisiune." };
  await runBatch(db, [
    db.delete(comments).where(eq(comments.id, commentId)),
    auditInsert(db, auditContext(me), [commentAudit("DELETE", prev)]),
  ]);
  return { success: true };
}

/* ------------------------------------------------------------ pașii */

const FARA_DREPT_PAS = "Pasul nu mai există sau nu ai dreptul să-l modifici.";

export async function addSubtask(db: Db, me: Actor | null, taskId: string, title: string): Promise<{ error?: string }> {
  const trimmed = title.trim();
  if (!trimmed) return { error: "Pasul nu poate fi gol." };
  if (!me) return { error: NEAUTENTIFICAT };
  const task = await getTaskRow(db, taskId);
  if (!task || !canWriteSubtasks(me, task)) return { error: "Nu ai dreptul să adaugi pași la această sarcină." };

  const last = await db
    .select({ position: sql<number>`max(${subtasks.position})` })
    .from(subtasks)
    .where(eq(subtasks.task_id, taskId))
    .get();
  const position = (last?.position ?? -1) + 1;
  const ctx = auditContext(me);
  const row = { id: crypto.randomUUID(), task_id: taskId, title: trimmed, done: false, position, done_at: null, created_at: ctx.at };
  await runBatch(db, [db.insert(subtasks).values(row), auditInsert(db, ctx, [subtaskAudit("INSERT", null, row)])]);
  return {};
}

export async function toggleSubtask(
  db: Db,
  me: Actor | null,
  id: string,
  done: boolean,
): Promise<{ error?: string }> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await db.select().from(subtasks).where(eq(subtasks.id, id)).get();
  const task = prev ? await getTaskRow(db, prev.task_id) : undefined;
  if (!prev || !task || !canWriteSubtasks(me, task)) return { error: FARA_DREPT_PAS };

  const ctx = auditContext(me);
  const next = { ...prev, done, done_at: done ? ctx.at : null };
  const statements: Statement[] = [
    db.update(subtasks).set({ done: next.done, done_at: next.done_at }).where(eq(subtasks.id, id)),
    auditInsert(db, ctx, [subtaskAudit("UPDATE", prev, next)]),
  ];

  // Pașii mută singuri sarcina prin fluxul demersului: expediat → așteaptă
  // instanța (termenul nu mai curge), răspuns primit → gata. Mutarea intră în
  // același `batch` cu bifa: pasul nu poate rămâne bifat cu sarcina nemișcată.
  let move: Partial<TaskRow> | null = null;
  if (done && isResponseStep(prev.title) && task.status !== "done") {
    move = { status: "done", waiting_since: null };
  } else if (done && isDispatchStep(prev.title) && (task.status === "todo" || task.status === "in_progress")) {
    // Doar dintr-o stare activă: o sarcină deja finalizată nu se redeschide.
    move = { status: "waiting", waiting_since: ctx.at };
  }
  if (move) {
    const update = await taskUpdate(db, me, ctx, task, move);
    if ("error" in update) return { error: `Pasul n-a fost bifat: ${update.error}` };
    statements.push(...update.statements);
  }

  await runBatch(db, statements);
  return {};
}

export async function deleteSubtask(db: Db, me: Actor | null, id: string): Promise<{ error?: string }> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await db.select().from(subtasks).where(eq(subtasks.id, id)).get();
  const task = prev ? await getTaskRow(db, prev.task_id) : undefined;
  if (!prev || !task || !canWriteSubtasks(me, task)) {
    return { error: "Pasul nu mai există sau nu ai dreptul să-l ștergi." };
  }
  await runBatch(db, [
    db.delete(subtasks).where(eq(subtasks.id, id)),
    auditInsert(db, auditContext(me), [subtaskAudit("DELETE", prev, null)]),
  ]);
  return {};
}

/** Adaugă pașii standard (din șabloanele etichetelor sarcinii) care lipsesc. */
export async function applyTemplateSubtasks(
  db: Db,
  me: Actor | null,
  taskId: string,
): Promise<{ error?: string; added?: number }> {
  if (!me) return { error: NEAUTENTIFICAT };
  const task = await getTaskRow(db, taskId);
  if (!task || !canWriteSubtasks(me, task)) return { error: "Nu ai dreptul să adaugi pași la această sarcină." };

  const [tagRows, existing] = await db.batch([
    db
      .select({ name: tags.name })
      .from(taskTags)
      .innerJoin(tags, eq(tags.id, taskTags.tag_id))
      .where(eq(taskTags.task_id, taskId)),
    db.select({ title: subtasks.title, position: subtasks.position }).from(subtasks).where(eq(subtasks.task_id, taskId)),
  ]);
  const rows = templateRows(taskId, tagRows.map((t) => t.name), existing);
  if (rows.length === 0) return { added: 0 };
  await runBatch(db, subtaskInserts(db, auditContext(me), rows));
  return { added: rows.length };
}
