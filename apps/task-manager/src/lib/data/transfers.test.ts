import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import * as t from "./transfers";
import { ADMIN, ANA, BOB, seedPeople } from "./test-helpers";

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  await seedPeople(db);
});
afterAll(() => dispose());
beforeEach(async () => {
  await db.delete(s.auditLog);
  await db.delete(s.transfers);
});

const rand = (over: Partial<t.TransferInput> = {}): t.TransferInput => ({
  transfer_date: "2026-10-01",
  institution: "3",
  kind: "planificat",
  plecati: "2",
  sositi: "1",
  note: "",
  ...over,
});

async function only() {
  const rows = await db.select().from(s.transfers);
  expect(rows).toHaveLength(1);
  return rows[0];
}

describe("transferurile", () => {
  it("fără sesiune nu se scrie nimic", async () => {
    expect(await t.createTransfer(db, null, rand())).toEqual({ error: "Neautentificat." });
  });

  it("refuză penitenciarul 6 și duplicatul zi + penitenciar + tip", async () => {
    expect((await t.createTransfer(db, ANA, rand({ institution: "6" }))).error).toBe("Alege penitenciarul partener.");
    expect(await t.createTransfer(db, ANA, rand())).toEqual({ success: true });
    expect((await t.createTransfer(db, BOB, rand())).error).toMatch(/Există deja un rând/);
  });

  it("orice membru corectează; jurnalul are cifrele noi", async () => {
    await t.createTransfer(db, ANA, rand());
    const row = await only();
    expect(await t.updateTransfer(db, BOB, row.id, rand({ plecati: "4" }))).toEqual({ success: true });
    const after = await only();
    expect([after.total, after.updated_by]).toEqual([5, BOB.id]);
    const audit = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(audit[1]).toMatchObject({
      action: "UPDATE",
      details: { transfer_date: "2026-10-01", institution: 3, plecati: 4, sositi: 1 },
    });
  });

  it("corectarea unui rând inexistent nu e reușită", async () => {
    expect((await t.updateTransfer(db, ANA, "nu-exista", rand())).error).toMatch(/nu mai există/);
  });

  it("doar adminul șterge", async () => {
    await t.createTransfer(db, ANA, rand());
    const row = await only();
    expect((await t.deleteTransfer(db, ANA, row.id)).error).toMatch(/rezervată adminului/);
    expect(await t.deleteTransfer(db, ADMIN, row.id)).toEqual({ success: true });
  });
});
