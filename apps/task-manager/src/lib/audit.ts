/**
 * Jurnalul de audit, scris de aplicație în locul triggerelor din Postgres.
 *
 * Câmpurile `details` sunt **aceleași** cu ce scriau triggerele, cheie cu
 * cheie: `audit-table.tsx`, `task-history.tsx` și istoricul vechi importat se
 * citesc la fel, fără să știe că sursa s-a schimbat. Fiecare funcție de mai jos
 * spune în comentariu ce trigger reproduce, în versiunea lui finală.
 *
 * Reguli preluate de la triggere:
 * - orice `update` executat se jurnalizează, chiar dacă n-a schimbat nimic —
 *   triggerul `after update` nu se uita la valori;
 * - „s-a schimbat" înseamnă `is distinct from`: două valori nule nu diferă;
 * - rândul de jurnal intră în **același** `batch` D1 cu schimbarea, deci o
 *   schimbare fără urmă sau o urmă fără schimbare nu pot exista;
 * - toate rândurile unei acțiuni poartă aceeași clipă, cum `now()` din Postgres
 *   era aceeași în toată tranzacția.
 */

import { sql } from "drizzle-orm";

import type { Actor } from "@/lib/acl";
import type { Db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export type AuditOp = "INSERT" | "UPDATE" | "DELETE";

export interface AuditDraft {
  action: AuditOp;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
}

/** Cine și când — o dată pe acțiune. `actor` nul: o scriere a sistemului. */
export interface AuditContext {
  actor: Actor | null;
  at: string;
}

export function auditContext(actor: Actor | null, now = new Date()): AuditContext {
  return { actor, at: now.toISOString() };
}

type Row = Record<string, unknown>;

/** `is distinct from`: nul față de nul nu e o schimbare. */
const distinct = (a: unknown, b: unknown) => (a ?? null) !== (b ?? null);

/** Rândul „rec" al triggerului: cel vechi la ștergere, cel nou altfel. */
const recOf = (op: AuditOp, oldRow: Row | null, newRow: Row | null): Row =>
  (op === "DELETE" ? oldRow : newRow) ?? {};

/** Numele de afișat ale profilelor, pentru `assignee_from`/`assignee_to`. */
export type NameOf = (profileId: unknown) => string | null;

/* ------------------------------------------------------------ record_audit (0033) */

/** `record_audit`, ramura `tasks`. */
export function taskAudit(op: AuditOp, oldRow: Row | null, newRow: Row | null, nameOf: NameOf): AuditDraft {
  const rec = recOf(op, oldRow, newRow);
  let det: Row;
  if (op === "UPDATE" && oldRow && newRow) {
    det = { title: newRow.title };
    if (distinct(newRow.status, oldRow.status))
      det = { ...det, status_from: oldRow.status, status_to: newRow.status };
    if (distinct(newRow.priority, oldRow.priority))
      det = { ...det, priority_from: oldRow.priority, priority_to: newRow.priority };
    if (distinct(newRow.assignee_id, oldRow.assignee_id))
      det = { ...det, assignee_from: nameOf(oldRow.assignee_id), assignee_to: nameOf(newRow.assignee_id) };
    if (distinct(newRow.title, oldRow.title))
      det = { ...det, title_from: oldRow.title, title_to: newRow.title };
    if (distinct(newRow.due_date, oldRow.due_date))
      det = { ...det, due_from: oldRow.due_date, due_to: newRow.due_date };
    if (distinct(newRow.appealed_csj, oldRow.appealed_csj)) det = { ...det, csj_to: newRow.appealed_csj };
  } else {
    det = { title: rec.title, status: rec.status, priority: rec.priority };
  }
  return { action: op, entity: "tasks", entity_id: rec.id as string, details: det };
}

/** `record_audit`, ramura `subtasks`. */
export function subtaskAudit(op: AuditOp, oldRow: Row | null, newRow: Row | null): AuditDraft {
  const rec = recOf(op, oldRow, newRow);
  let det: Row = { task_id: rec.task_id, title: rec.title };
  if (op === "UPDATE" && oldRow && newRow && distinct(newRow.done, oldRow.done))
    det = { ...det, done_to: newRow.done };
  return { action: op, entity: "subtasks", entity_id: rec.id as string, details: det };
}

/** `record_audit`, ramura `petitions`. */
export function petitionAudit(op: AuditOp, oldRow: Row | null, newRow: Row | null, nameOf: NameOf): AuditDraft {
  const rec = recOf(op, oldRow, newRow);
  let det: Row = { number: rec.number, petitioner: rec.petitioner };
  if (op === "UPDATE" && oldRow && newRow) {
    if (distinct(newRow.status, oldRow.status))
      det = { ...det, status_from: oldRow.status, status_to: newRow.status };
    if (distinct(newRow.assignee_id, oldRow.assignee_id))
      det = { ...det, assignee_from: nameOf(oldRow.assignee_id), assignee_to: nameOf(newRow.assignee_id) };
    if (distinct(newRow.received_date, oldRow.received_date))
      det = { ...det, received_from: oldRow.received_date, received_to: newRow.received_date };
    if (distinct(newRow.number, oldRow.number))
      det = { ...det, number_from: oldRow.number, number_to: newRow.number };
  }
  return { action: op, entity: "petitions", entity_id: rec.id as string, details: det };
}

/** `record_audit`, ramura `petition_attachments`; numărul vine din petiție. */
export function attachmentAudit(op: AuditOp, rec: Row, petitionNumber: string | null): AuditDraft {
  return {
    action: op,
    entity: "petition_attachments",
    entity_id: rec.id as string,
    details: { number: petitionNumber, name: rec.name },
  };
}

/** Totalul ședințelor, coloana generată `total_general`. */
const hearingTotal = (r: Row) =>
  Number(r.tc_petrecute ?? 0) + Number(r.tc_amanate ?? 0) + Number(r.ij_petrecute ?? 0) + Number(r.ij_amanate ?? 0);

/** `record_audit`, ramura `hearings`. */
export function hearingAudit(op: AuditOp, oldRow: Row | null, newRow: Row | null): AuditDraft {
  const rec = recOf(op, oldRow, newRow);
  let det: Row = { session_date: rec.session_date, total: hearingTotal(rec) };
  if (op === "UPDATE" && oldRow && newRow && hearingTotal(newRow) !== hearingTotal(oldRow))
    det = { ...det, total_from: hearingTotal(oldRow), total_to: hearingTotal(newRow) };
  return { action: op, entity: "hearings", entity_id: rec.id as string, details: det };
}

/** `record_audit`, ramura `transfers`. */
export function transferAudit(op: AuditOp, oldRow: Row | null, newRow: Row | null): AuditDraft {
  const rec = recOf(op, oldRow, newRow);
  return {
    action: op,
    entity: "transfers",
    entity_id: rec.id as string,
    details: {
      transfer_date: rec.transfer_date,
      institution: rec.institution,
      plecati: rec.plecati,
      sositi: rec.sositi,
    },
  };
}

/** `record_audit`, ramura `comments`. */
export function commentAudit(op: AuditOp, rec: Row): AuditDraft {
  return { action: op, entity: "comments", entity_id: rec.id as string, details: { task_id: rec.task_id } };
}

/** `record_audit`, ramura `tags`. */
export function tagAudit(op: AuditOp, rec: Row): AuditDraft {
  return { action: op, entity: "tags", entity_id: rec.id as string, details: { name: rec.name } };
}

/** `record_audit`, ramura `task_tags` — fără `entity_id`: cheia e perechea. */
export function taskTagAudit(op: AuditOp, rec: { task_id: string; tag_id: string }): AuditDraft {
  return { action: op, entity: "task_tags", entity_id: null, details: { task_id: rec.task_id, tag_id: rec.tag_id } };
}

/** `record_audit`, ramura `profiles`. */
export function profileAudit(op: AuditOp, rec: Row): AuditDraft {
  return {
    action: op,
    entity: "profiles",
    entity_id: rec.id as string,
    details: { full_name: rec.full_name ?? null, role: rec.role ?? null },
  };
}

/* ------------------------------------------------------------ triggerele proprii */

/** `record_transfer_plan_audit` (0029). */
export function transferPlanAudit(op: AuditOp, oldRow: Row | null, newRow: Row | null): AuditDraft {
  const rec = recOf(op, oldRow, newRow);
  let det: Row = {
    name: `${rec.last_name} ${rec.first_name}`,
    court: rec.court ?? null,
    hearing_date: rec.hearing_date ?? null,
  };
  if (op === "UPDATE" && oldRow && newRow) {
    if (distinct(newRow.hearing_date, oldRow.hearing_date))
      det = { ...det, hearing_from: oldRow.hearing_date ?? null, hearing_to: newRow.hearing_date ?? null };
    if (distinct(newRow.done, oldRow.done)) det = { ...det, done_to: newRow.done };
    if (distinct(newRow.notified_at, oldRow.notified_at))
      det = {
        ...det,
        notified_to: newRow.notified_at != null,
        notified_for_hearing: newRow.notified_hearing_date ?? null,
      };
  }
  return { action: op, entity: "transfer_plans", entity_id: rec.id as string, details: det };
}

/** `record_obligation_audit`, ramura `obligation_completions` (doar insert și delete). */
export function completionAudit(op: "INSERT" | "DELETE", rec: Row, obligationTitle: string | null): AuditDraft {
  return {
    action: op,
    entity: "obligation_completions",
    entity_id: rec.id as string,
    details: { title: obligationTitle, due_date: rec.due_date },
  };
}

/** `record_defendant_audit` (0025). */
export function defendantAudit(op: AuditOp, oldRow: Row | null, newRow: Row | null): AuditDraft {
  const rec = recOf(op, oldRow, newRow);
  let det: Row = { name: `${rec.last_name} ${rec.first_name}`, regime: rec.regime, status: rec.status };
  if (op === "UPDATE" && oldRow && newRow) {
    if (distinct(newRow.status, oldRow.status))
      det = { ...det, status_from: oldRow.status, status_to: newRow.status };
    if (distinct(newRow.regime, oldRow.regime))
      det = { ...det, regime_from: oldRow.regime, regime_to: newRow.regime };
  }
  return { action: op, entity: "defendants", entity_id: rec.id as string, details: det };
}

/** `record_release_audit` (0026). */
export function releaseAudit(op: AuditOp, oldRow: Row | null, newRow: Row | null): AuditDraft {
  const rec = recOf(op, oldRow, newRow);
  let det: Row = { release_date: rec.release_date, count: rec.count };
  if (op === "UPDATE" && oldRow && newRow && distinct(newRow.count, oldRow.count))
    det = { ...det, count_from: oldRow.count, count_to: newRow.count };
  return { action: op, entity: "releases", entity_id: rec.id as string, details: det };
}

/** `record_contravener_audit` (0032). */
export function contravenerAudit(op: AuditOp, oldRow: Row | null, newRow: Row | null): AuditDraft {
  const rec = recOf(op, oldRow, newRow);
  let det: Row = { name: `${rec.last_name} ${rec.first_name}`, arrest_days: rec.arrest_days };
  if (op === "UPDATE" && oldRow && newRow) {
    if (distinct(newRow.arrest_days, oldRow.arrest_days))
      det = { ...det, days_from: oldRow.arrest_days, days_to: newRow.arrest_days };
    if (distinct(newRow.final_date, oldRow.final_date))
      det = { ...det, final_from: oldRow.final_date ?? null, final_to: newRow.final_date ?? null };
    if (distinct(newRow.executed_on, oldRow.executed_on))
      det = { ...det, executed_from: oldRow.executed_on ?? null, executed_to: newRow.executed_on ?? null };
    if ((newRow.informed_at == null) !== (oldRow.informed_at == null))
      det = { ...det, informed: newRow.informed_at != null };
  }
  return { action: op, entity: "contraveners", entity_id: rec.id as string, details: det };
}

/* ------------------------------------------------------------ scrierea */

/**
 * Câte rânduri de jurnal încap într-o instrucțiune. D1 primește cel mult 100
 * de parametri pe instrucțiune, iar un rând are 8; peste 12 rânduri (de pildă
 * ștergerea unei sarcini cu multe comentarii și subsarcini) cererea era
 * refuzată și acțiunea eșua întreagă.
 */
export const RANDURI_PE_INSTRUCTIUNE = 12;

/** Lista tăiată în bucăți de cel mult `n`. */
export function inBucati<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

function randJurnal(ctx: AuditContext, d: AuditDraft) {
  return {
    id: crypto.randomUUID(),
    actor_id: ctx.actor?.id ?? null,
    actor_name: ctx.actor?.name ?? null,
    action: d.action,
    entity: d.entity,
    entity_id: d.entity_id,
    details: d.details,
    created_at: ctx.at,
  };
}

/**
 * Inserarea rândurilor de jurnal, de pus în același `batch` cu schimbarea.
 * Întoarce una sau mai multe instrucțiuni (vezi `RANDURI_PE_INSTRUCTIUNE`);
 * `runBatch` le primește așa cum sunt.
 */
export function auditInsert(db: Db, ctx: AuditContext, drafts: AuditDraft[]) {
  return inBucati(drafts, RANDURI_PE_INSTRUCTIUNE).map((parte) =>
    db.insert(auditLog).values(parte.map((d) => randJurnal(ctx, d))),
  );
}

/**
 * Jurnalul unei modificări care poate să nu mai găsească rândul: se scrie doar
 * dacă instrucțiunea de dinaintea lui, din același `batch`, a atins ceva.
 *
 * Verificarea „rândul există" se face înainte de lot, deci între ea și lot
 * altcineva îl poate șterge. Fără condiție, `UPDATE`/`DELETE` nu atingea nimic,
 * dar jurnalul scria totuși schimbarea (iar o anulare dublă scria două
 * ștergeri). `changes()` e numărul de rânduri atinse de instrucțiunea
 * anterioară pe aceeași legătură; lotul D1 e o singură tranzacție, deci nu se
 * poate strecura nimic între ele. La mai multe bucăți, a doua se uită la
 * prima: dacă prima n-a scris, nici ea nu scrie.
 */
export function auditDupaSchimbare(db: Db, ctx: AuditContext, drafts: AuditDraft[]) {
  return inBucati(drafts, RANDURI_PE_INSTRUCTIUNE).map((parte) => {
    const valori = parte.map((d) => {
      const r = randJurnal(ctx, d);
      return sql`(${r.id}, ${r.actor_id}, ${r.actor_name}, ${r.action}, ${r.entity}, ${r.entity_id}, ${JSON.stringify(r.details)}, ${r.created_at})`;
    });
    // O singură listă `values`, nu `select … union all select …`: D1 refuză
    // mai mult de câteva select-uri unite, iar lista nu are limita asta.
    // Coloanele urmează ordinea din tabel: insert-ul le numește pe toate.
    return db
      .insert(auditLog)
      .select(
        sql`select column1, column2, column3, column4, column5, column6, column7, column8 from (values ${sql.join(valori, sql`, `)}) where changes() > 0`,
      );
  });
}
