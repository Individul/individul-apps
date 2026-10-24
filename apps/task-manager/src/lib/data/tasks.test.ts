import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { TaskInput } from "@/lib/schemas";
import * as t from "./tasks";
import { ADMIN, ANA, BOB, notificationsOf, seedPeople } from "./test-helpers";

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  await seedPeople(db);
});
afterAll(() => dispose());

beforeEach(async () => {
  for (const table of [s.auditLog, s.notifications, s.comments, s.subtasks, s.taskTags, s.tasks, s.tags]) {
    await db.delete(table);
  }
});

const input = (over: Partial<TaskInput> = {}): TaskInput => ({
  title: "Demers Popescu",
  description: "",
  status: "todo",
  priority: "medium",
  due_date: "",
  assignee_id: "",
  ...over,
});

async function onlyTask() {
  const rows = await db.select().from(s.tasks);
  expect(rows).toHaveLength(1);
  return rows[0];
}

/** Jurnalul unei entități, în ordinea scrierii. */
async function audit(entity: string) {
  return db
    .select()
    .from(s.auditLog)
    .where(eq(s.auditLog.entity, entity))
    .orderBy(sql`rowid`);
}

describe("sarcinile: dreptul de a scrie", () => {
  it("fără sesiune nu se scrie nimic", async () => {
    expect(await t.createTask(db, null, input())).toEqual({ error: "Neautentificat." });
    expect(await db.select().from(s.tasks)).toEqual([]);
  });

  it("un membru își creează sarcina pe el sau fără responsabil, nu pe altul", async () => {
    expect(await t.createTask(db, ANA, input({ assignee_id: ANA.id }))).toEqual({ success: true });
    const refuz = await t.createTask(db, ANA, input({ assignee_id: BOB.id }));
    expect(refuz.error).toBeTruthy();
    expect(await db.select().from(s.tasks)).toHaveLength(1);
  });

  it("adminul atribuie oricui", async () => {
    expect(await t.createTask(db, ADMIN, input({ assignee_id: BOB.id }))).toEqual({ success: true });
  });

  it("modifică doar adminul, autorul sau responsabilul", async () => {
    await t.createTask(db, ADMIN, input({ assignee_id: ANA.id }));
    const task = await onlyTask();
    expect((await t.updateTask(db, BOB, task.id, input({ title: "Alt", assignee_id: ANA.id }))).error).toBe(
      "Sarcină inexistentă sau fără permisiune.",
    );
    expect(await t.updateTask(db, ANA, task.id, input({ title: "Nou", assignee_id: ANA.id }))).toEqual({
      success: true,
    });
    expect((await onlyTask()).title).toBe("Nou");
  });

  it("doar adminul schimbă responsabilul, cu mesajul gărzii de odinioară", async () => {
    await t.createTask(db, ANA, input({ assignee_id: ANA.id }));
    const task = await onlyTask();
    expect(await t.updateTask(db, ANA, task.id, input({ assignee_id: BOB.id }))).toEqual({
      error: "Doar adminul poate schimba responsabilul.",
    });
    expect((await onlyTask()).assignee_id).toBe(ANA.id);
    expect(await t.updateTask(db, ADMIN, task.id, input({ assignee_id: BOB.id }))).toEqual({ success: true });
  });

  it("șterge doar adminul sau autorul — nici măcar responsabilul", async () => {
    await t.createTask(db, ADMIN, input({ assignee_id: ANA.id }));
    const task = await onlyTask();
    expect((await t.deleteTask(db, ANA, task.id)).error).toBeTruthy();
    expect(await t.deleteTask(db, ADMIN, task.id)).toEqual({ success: true });
    expect(await db.select().from(s.tasks)).toEqual([]);
  });

  it("o sarcină cu multe comentarii se șterge, cu tot jurnalul cascadei", async () => {
    await t.createTask(db, ADMIN, input());
    const task = await onlyTask();
    // 20 de comentarii + sarcina = 21 de rânduri de jurnal, 168 de parametri:
    // într-o singură instrucțiune, D1 refuza (limita e 100).
    await db.insert(s.comments).values(
      Array.from({ length: 20 }, (_, i) => ({ id: crypto.randomUUID(), task_id: task.id, author_id: ANA.id, body: `c${i}` })),
    );
    expect(await t.deleteTask(db, ADMIN, task.id)).toEqual({ success: true });
    expect(await db.select().from(s.tasks)).toEqual([]);
    expect((await audit("comments")).filter((r) => r.action === "DELETE")).toHaveLength(20);
    // A doua ștergere, ca de la un al doilea om în aceeași clipă, nu mai
    // găsește sarcina și nu mai scrie nimic.
    expect((await t.deleteTask(db, ADMIN, task.id)).error).toBeTruthy();
  });

  it("finalizarea și semnul CSJ urmează regula de modificare", async () => {
    await t.createTask(db, ANA, input({ assignee_id: ANA.id }));
    const task = await onlyTask();
    expect((await t.finalizeTask(db, BOB, task.id)).error).toBeTruthy();
    expect((await t.setTaskAppealedCsj(db, BOB, task.id, true)).error).toBeTruthy();
    expect(await t.setTaskAppealedCsj(db, ANA, task.id, true)).toEqual({ success: true });
    expect(await t.finalizeTask(db, ANA, task.id)).toEqual({ success: true });
    const after = await onlyTask();
    expect([after.status, after.appealed_csj]).toEqual(["done", true]);
  });
});

describe("sarcinile: ce puneau triggerele", () => {
  it("completed_at: pus la intrarea în „Gata”, golit la ieșire", async () => {
    await t.createTask(db, ANA, input({ status: "done" }));
    const born = await onlyTask();
    expect(born.completed_at).toBe(born.created_at);

    await t.updateTask(db, ANA, born.id, input({ status: "in_progress" }));
    expect((await onlyTask()).completed_at).toBeNull();

    await t.finalizeTask(db, ANA, born.id);
    const done = await onlyTask();
    expect(done.completed_at).toBe(done.updated_at);
  });

  it("completed_at rămâne neatins cât timp sarcina rămâne „Gata”", async () => {
    await t.createTask(db, ANA, input({ status: "done" }));
    const task = await onlyTask();
    await db.update(s.tasks).set({ completed_at: "2026-01-02T03:04:05.000Z" }).where(eq(s.tasks.id, task.id));
    await t.setTaskAppealedCsj(db, ANA, task.id, true);
    expect((await onlyTask()).completed_at).toBe("2026-01-02T03:04:05.000Z");
  });

  it("waiting_since se păstrează cât timp sarcina așteaptă", async () => {
    await t.createTask(db, ANA, input({ status: "waiting" }));
    const first = (await onlyTask()).waiting_since;
    expect(first).toBeTruthy();
    await t.updateTask(db, ANA, (await onlyTask()).id, input({ status: "waiting", title: "Alt titlu" }));
    expect((await onlyTask()).waiting_since).toBe(first);
  });
});

describe("sarcinile: jurnalul, cheie cu cheie ca triggerul", () => {
  it("inserare: titlu, stare, prioritate; actorul și numele lui", async () => {
    await t.createTask(db, ANA, input());
    const [row] = await audit("tasks");
    expect(row).toMatchObject({ action: "INSERT", actor_id: ANA.id, actor_name: "Ana Popa" });
    expect(row.details).toEqual({ title: "Demers Popescu", status: "todo", priority: "medium" });
  });

  it("actualizare: doar ce s-a schimbat, cu numele responsabililor", async () => {
    await t.createTask(db, ADMIN, input({ assignee_id: ANA.id, due_date: "2026-11-01" }));
    const task = await onlyTask();
    await t.updateTask(
      db,
      ADMIN,
      task.id,
      input({ title: "Nou", status: "in_progress", assignee_id: BOB.id, due_date: "2026-11-05", appealed_csj: true }),
    );
    const rows = await audit("tasks");
    expect(rows[1].details).toEqual({
      title: "Nou",
      status_from: "todo",
      status_to: "in_progress",
      assignee_from: "Ana Popa",
      assignee_to: "Bob Rusu",
      title_from: "Demers Popescu",
      title_to: "Nou",
      due_from: "2026-11-01",
      due_to: "2026-11-05",
      csj_to: true,
    });
  });

  it("o salvare fără schimbări tot se jurnalizează, doar cu titlul", async () => {
    await t.createTask(db, ANA, input());
    await t.updateTask(db, ANA, (await onlyTask()).id, input());
    const rows = await audit("tasks");
    expect(rows.map((r) => r.details)).toEqual([
      { title: "Demers Popescu", status: "todo", priority: "medium" },
      { title: "Demers Popescu" },
    ]);
  });

  it("ștergerea jurnalizează și ce pleacă în cascadă, înaintea sarcinii", async () => {
    const tag = await t.createTag(db, ADMIN, "Fără șablon", "#000000");
    await t.createTask(db, ANA, input(), [tag.tag!.id]);
    const task = await onlyTask();
    await t.addComment(db, BOB, task.id, "Văzut");
    await t.addSubtask(db, ANA, task.id, "Pas");
    await db.delete(s.auditLog);

    await t.deleteTask(db, ANA, task.id);
    const rows = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(rows.map((r) => `${r.entity}:${r.action}`)).toEqual([
      "comments:DELETE",
      "subtasks:DELETE",
      "task_tags:DELETE",
      "tasks:DELETE",
    ]);
    expect(new Set(rows.map((r) => r.created_at)).size).toBe(1);
    expect(await db.select().from(s.comments)).toEqual([]);
  });
});

describe("etichetele", () => {
  it("doar adminul le creează, modifică și șterge", async () => {
    expect((await t.createTag(db, ANA, "X", "#111111")).error).toBe("Doar adminul poate crea etichete.");
    const { tag } = await t.createTag(db, ADMIN, "X", "#111111");
    expect((await t.updateTag(db, ANA, tag!.id, "Y", "#111111")).error).toBeTruthy();
    expect((await t.deleteTag(db, ANA, tag!.id)).error).toBeTruthy();
    expect((await t.createTag(db, ADMIN, "X", "#222222")).error).toBe("Există deja o etichetă cu numele acesta.");
  });

  it("oricine conectat leagă o etichetă; a doua oară e tot reușită", async () => {
    const { tag } = await t.createTag(db, ADMIN, "X", "#111111");
    await t.createTask(db, ANA, input());
    const task = await onlyTask();
    expect(await t.attachTag(db, BOB, task.id, tag!.id)).toEqual({ success: true });
    expect(await t.attachTag(db, BOB, task.id, tag!.id)).toEqual({ success: true });
    expect(await db.select().from(s.taskTags)).toHaveLength(1);
    expect(await t.attachTag(db, null, task.id, tag!.id)).toEqual({ error: "Neautentificat." });
  });
});

describe("comentariile", () => {
  it("modifică doar autorul; șterge autorul sau adminul", async () => {
    await t.createTask(db, ANA, input());
    const task = await onlyTask();
    await t.addComment(db, BOB, task.id, "Primul");
    const [c] = await db.select().from(s.comments);
    expect((await t.editComment(db, ADMIN, c.id, "Schimbat")).error).toBeTruthy();
    expect((await t.deleteComment(db, ANA, c.id)).error).toBeTruthy();
    expect(await t.editComment(db, BOB, c.id, "Schimbat")).toEqual({ success: true });
    expect(await t.deleteComment(db, ADMIN, c.id)).toEqual({ success: true });
  });

  it("comentariul îl anunță pe autorul sarcinii, nu pe cel care scrie", async () => {
    await t.createTask(db, ANA, input());
    const task = await onlyTask();
    await t.addComment(db, BOB, task.id, "Salut");
    expect((await notificationsOf(db, ANA.id)).map((n) => n.type)).toEqual(["comment"]);
    expect(await notificationsOf(db, BOB.id)).toEqual([]);
  });
});

describe("pașii", () => {
  it("îi scrie doar cine poate modifica sarcina", async () => {
    await t.createTask(db, ANA, input());
    const task = await onlyTask();
    expect((await t.addSubtask(db, BOB, task.id, "Pas")).error).toBeTruthy();
    expect(await t.addSubtask(db, ANA, task.id, "Pas")).toEqual({});
    const [step] = await db.select().from(s.subtasks);
    expect((await t.toggleSubtask(db, BOB, step.id, true)).error).toBeTruthy();
    expect((await t.deleteSubtask(db, BOB, step.id)).error).toBeTruthy();
    expect(await t.deleteSubtask(db, ADMIN, step.id)).toEqual({});
  });

  it("bifarea jurnalizează done_to", async () => {
    await t.createTask(db, ANA, input());
    const task = await onlyTask();
    await t.addSubtask(db, ANA, task.id, "Pas");
    const [step] = await db.select().from(s.subtasks);
    await t.toggleSubtask(db, ANA, step.id, true);
    const rows = await audit("subtasks");
    expect(rows.map((r) => r.details)).toEqual([
      { task_id: task.id, title: "Pas" },
      { task_id: task.id, title: "Pas", done_to: true },
    ]);
  });
});
