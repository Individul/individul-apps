import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import * as p from "./petitions";
import { memoryStore } from "./memory-store";
import { ADMIN, ANA, BOB, notificationsOf, seedPeople } from "./test-helpers";

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  await seedPeople(db);
});
afterAll(() => dispose());

beforeEach(async () => {
  for (const table of [s.auditLog, s.notifications, s.petitionAttachments, s.petitions]) {
    await db.delete(table);
  }
});

const input = (over: Partial<p.PetitionInput> = {}): p.PetitionInput => ({
  petitioner: "Ion Popescu",
  petitioner_type: "detinut",
  subject: "",
  received_date: "2026-10-01",
  assignee_id: "",
  status: "in_examinare",
  response: "",
  response_date: "",
  ...over,
});

async function onlyPetition() {
  const rows = await db.select().from(s.petitions);
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function audit(entity: string) {
  return db.select().from(s.auditLog).where(eq(s.auditLog.entity, entity)).orderBy(sql`rowid`);
}

describe("petițiile: dreptul de a scrie", () => {
  it("fără sesiune nu se scrie nimic", async () => {
    expect(await p.createPetition(db, null, "M-1", input())).toEqual({ error: "Neautentificat." });
    expect(await db.select().from(s.petitions)).toEqual([]);
  });

  it("creează orice om conectat; numărul primește anul, termenul îl calculează baza", async () => {
    const res = await p.createPetition(db, BOB, "M-535", input());
    expect(res).toMatchObject({ success: true, number: "M-535/26" });
    const row = await onlyPetition();
    expect([row.created_by, row.response_deadline]).toEqual([BOB.id, "2026-10-28"]);
  });

  it("numărul e unic, cu mesajul de până acum", async () => {
    await p.createPetition(db, ANA, "M-1", input());
    expect(await p.createPetition(db, BOB, "M-1", input())).toEqual({
      error: "Există deja o petiție cu acest număr.",
    });
  });

  it("modifică doar adminul, creatorul sau responsabilul", async () => {
    await p.createPetition(db, ADMIN, "M-1", input({ assignee_id: ANA.id }));
    const row = await onlyPetition();
    expect(await p.updatePetition(db, BOB, row.id, row.number, input({ assignee_id: ANA.id }))).toEqual({
      error: "Petiție inexistentă sau fără permisiune.",
    });
    expect(
      await p.updatePetition(db, ANA, row.id, row.number, input({ assignee_id: ANA.id, subject: "Transfer" })),
    ).toEqual({ success: true });
    expect((await onlyPetition()).subject).toBe("Transfer");
  });

  it("un responsabil care nu e creator nu poate muta petiția pe altul (WITH CHECK)", async () => {
    await p.createPetition(db, ADMIN, "M-1", input({ assignee_id: ANA.id }));
    const row = await onlyPetition();
    const res = await p.updatePetition(db, ANA, row.id, row.number, input({ assignee_id: BOB.id }));
    expect(res.error).toMatch(/doar creatorul petiției sau un administrator/);
    expect((await onlyPetition()).assignee_id).toBe(ANA.id);
  });

  it("creatorul membru poate muta petiția pe altul", async () => {
    await p.createPetition(db, ANA, "M-1", input({ assignee_id: ANA.id }));
    const row = await onlyPetition();
    expect(await p.updatePetition(db, ANA, row.id, row.number, input({ assignee_id: BOB.id }))).toEqual({
      success: true,
    });
  });

  it("șterge doar adminul sau creatorul — nu și responsabilul", async () => {
    await p.createPetition(db, ADMIN, "M-1", input({ assignee_id: ANA.id }));
    const row = await onlyPetition();
    const files = memoryStore();
    expect((await p.deletePetition(db, files, ANA, row.id)).error).toBeTruthy();
    expect(await p.deletePetition(db, files, ADMIN, row.id)).toEqual({ success: true });
    expect(await db.select().from(s.petitions)).toEqual([]);
  });

  it("finalizarea: responsabilul da, străinul nu; data răspunsului se completează", async () => {
    await p.createPetition(db, ADMIN, "M-1", input({ assignee_id: ANA.id }));
    const row = await onlyPetition();
    expect((await p.finalizePetition(db, BOB, row.id)).error).toBeTruthy();
    expect(await p.finalizePetition(db, ANA, row.id)).toEqual({ success: true });
    const after = await onlyPetition();
    expect(after.status).toBe("solutionat");
    expect(after.response_date).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(after.updated_at).not.toBe(row.updated_at);
  });

  it("finalizarea păstrează o dată a răspunsului deja scrisă", async () => {
    await p.createPetition(db, ANA, "M-1", input({ response_date: "2026-10-05" }));
    await p.finalizePetition(db, ANA, (await onlyPetition()).id);
    expect((await onlyPetition()).response_date).toBe("2026-10-05");
  });
});

describe("petițiile: jurnalul, cheie cu cheie ca triggerul", () => {
  it("inserare: număr și petiționar", async () => {
    await p.createPetition(db, ANA, "M-1", input());
    const [row] = await audit("petitions");
    expect(row).toMatchObject({ action: "INSERT", actor_id: ANA.id, actor_name: "Ana Popa" });
    expect(row.details).toEqual({ number: "M-1/26", petitioner: "Ion Popescu" });
  });

  it("actualizare: stare, responsabil (cu nume), data primirii, număr", async () => {
    await p.createPetition(db, ADMIN, "M-1", input({ assignee_id: ANA.id }));
    const row = await onlyPetition();
    await p.updatePetition(
      db,
      ADMIN,
      row.id,
      "M-2/26",
      input({ assignee_id: BOB.id, status: "solutionat", received_date: "2026-10-03" }),
    );
    const rows = await audit("petitions");
    expect(rows[1].details).toEqual({
      number: "M-2/26",
      petitioner: "Ion Popescu",
      status_from: "in_examinare",
      status_to: "solutionat",
      assignee_from: "Ana Popa",
      assignee_to: "Bob Rusu",
      received_from: "2026-10-01",
      received_to: "2026-10-03",
      number_from: "M-1/26",
      number_to: "M-2/26",
    });
  });

  it("ștergerea jurnalizează atașamentele înaintea petiției și le scoate din R2", async () => {
    await p.createPetition(db, ANA, "M-1", input());
    const row = await onlyPetition();
    const files = memoryStore();
    await files.put(`${row.id}/a.pdf`, new Uint8Array([1]));
    await db.insert(s.petitionAttachments).values({
      petition_id: row.id,
      kind: "petitie",
      path: `${row.id}/a.pdf`,
      name: "M-1-26-Ion-Popescu.pdf",
      uploaded_by: ANA.id,
    });
    await db.delete(s.auditLog);

    await p.deletePetition(db, files, ANA, row.id);
    const rows = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(rows.map((r) => `${r.entity}:${r.action}`)).toEqual([
      "petition_attachments:DELETE",
      "petitions:DELETE",
    ]);
    expect(rows[0].details).toEqual({ number: "M-1/26", name: "M-1-26-Ion-Popescu.pdf" });
    expect(await db.select().from(s.petitionAttachments)).toEqual([]);
    expect(files.keys()).toEqual([]);
  });
});

describe("petițiile: notificările", () => {
  it("atribuirea îl anunță pe noul responsabil", async () => {
    await p.createPetition(db, ADMIN, "M-1", input({ assignee_id: ANA.id }));
    expect((await notificationsOf(db, ANA.id)).map((n) => n.type)).toEqual(["assigned"]);
  });

  it("o salvare fără schimbări nu anunță pe nimeni", async () => {
    await p.createPetition(db, ANA, "M-1", input());
    const row = await onlyPetition();
    await db.delete(s.notifications);
    await p.updatePetition(db, ANA, row.id, row.number, input());
    expect(await db.select().from(s.notifications)).toEqual([]);
  });
});
