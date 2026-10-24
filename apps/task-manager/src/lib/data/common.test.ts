import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { auditContext, auditInsert, type AuditDraft } from "@/lib/audit";
import { modificaCuJurnal, runBatch } from "./common";
import { ANA, seedPeople } from "./test-helpers";

let db: Db;
let dispose: () => Promise<void>;
const OBL = "22222222-2222-4222-8222-222222222222";

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  await seedPeople(db);
  await db.insert(s.obligations).values({ id: OBL, title: "Raportul lunar", kind: "lunar_ultima_zi" });
});
afterAll(() => dispose());
beforeEach(async () => {
  await db.delete(s.auditLog);
  await db.delete(s.obligationCompletions);
});

const ciorne = (n: number): AuditDraft[] =>
  Array.from({ length: n }, (_, i) => ({ action: "DELETE", entity: "comments", entity_id: `c${i}`, details: { i } }));

async function bifa(due: string) {
  const id = crypto.randomUUID();
  await db.insert(s.obligationCompletions).values({ id, obligation_id: OBL, due_date: due, completed_by: ANA.id });
  return id;
}

describe("jurnalul, scris în același lot cu schimbarea", () => {
  it("30 de rânduri deodată trec, deși D1 primește doar 100 de parametri pe instrucțiune", async () => {
    await runBatch(db, [auditInsert(db, auditContext(ANA), ciorne(30))]);
    const randuri = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(randuri).toHaveLength(30);
    expect(randuri.at(-1)?.details).toEqual({ i: 29 });
  });

  it("o modificare a unui rând existent se jurnalizează", async () => {
    const id = await bifa("2026-09-30");
    const ok = await modificaCuJurnal(
      db,
      db.delete(s.obligationCompletions).where(eq(s.obligationCompletions.id, id)),
      auditContext(ANA),
      ciorne(1),
    );
    expect(ok).toBe(true);
    expect(await db.select().from(s.auditLog)).toHaveLength(1);
  });

  it("un rând dispărut între citire și scriere nu lasă urmă în jurnal", async () => {
    const id = await bifa("2026-09-30");
    const sterge = () =>
      modificaCuJurnal(
        db,
        db.delete(s.obligationCompletions).where(eq(s.obligationCompletions.id, id)),
        auditContext(ANA),
        ciorne(1),
      );
    // Doi oameni anulează aceeași bifă: amândoi au citit-o, al doilea nu mai
    // are ce șterge.
    expect(await sterge()).toBe(true);
    expect(await sterge()).toBe(false);
    expect(await db.select().from(s.auditLog)).toHaveLength(1);
  });

  it("condiția ține și când jurnalul trece în mai multe bucăți", async () => {
    const ok = await modificaCuJurnal(
      db,
      db.delete(s.obligationCompletions).where(eq(s.obligationCompletions.id, "nu-exista")),
      auditContext(ANA),
      ciorne(30),
    );
    expect(ok).toBe(false);
    expect(await db.select().from(s.auditLog)).toHaveLength(0);

    const id = await bifa("2026-10-31");
    expect(
      await modificaCuJurnal(
        db,
        db.update(s.obligationCompletions).set({ due_date: "2026-10-30" }).where(eq(s.obligationCompletions.id, id)),
        auditContext(ANA),
        ciorne(30),
      ),
    ).toBe(true);
    const randuri = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(randuri).toHaveLength(30);
    // Aceeași formă ca la `auditInsert`: detaliile se citesc înapoi ca obiect.
    expect(randuri[29]).toMatchObject({
      action: "DELETE",
      entity: "comments",
      entity_id: "c29",
      actor_id: ANA.id,
      actor_name: ANA.name,
      details: { i: 29 },
    });
  });
});
