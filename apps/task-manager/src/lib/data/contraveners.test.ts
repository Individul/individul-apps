import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { ContravenerInput } from "@/lib/contraveners";
import * as c from "./contraveners";
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
  await db.delete(s.contraveners);
});

// Definitivă de peste un an: termenul de executare a expirat, deci e prescrisă.
const hotarare = (over: Partial<ContravenerInput> = {}): ContravenerInput => ({
  last_name: "Rusu",
  first_name: "Vasile",
  patronymic: "",
  decision_date: "2024-01-10",
  final_date: "2024-01-20",
  arrest_days: "10",
  executed_on: "",
  ...over,
});

async function only() {
  const rows = await db.select().from(s.contraveners);
  expect(rows).toHaveLength(1);
  return rows[0];
}

describe("contravenienții", () => {
  it("fără sesiune nu se scrie nimic", async () => {
    expect(await c.saveContravener(db, null, null, hotarare())).toEqual({ error: "Neautentificat." });
  });

  it("corectarea zilelor și a datei definitive, în jurnal ca triggerul", async () => {
    await c.saveContravener(db, ANA, null, hotarare());
    const row = await only();
    expect(await c.saveContravener(db, BOB, row.id, hotarare({ arrest_days: "12", final_date: "2024-01-22" }))).toEqual({
      success: true,
    });
    const audit = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(audit[1].details).toEqual({
      name: "Rusu Vasile",
      arrest_days: 12,
      days_from: 10,
      days_to: 12,
      final_from: "2024-01-20",
      final_to: "2024-01-22",
    });
  });

  it("informarea: doar pe hotărâre prescrisă; jurnalul spune „informed”", async () => {
    await c.saveContravener(db, ANA, null, hotarare({ final_date: "" }));
    const fara = await only();
    expect((await c.setContravenerInformed(db, BOB, fara.id, true)).error).toBeTruthy();
    await db.delete(s.contraveners);

    await c.saveContravener(db, ANA, null, hotarare());
    const row = await only();
    expect(await c.setContravenerInformed(db, BOB, row.id, true)).toEqual({ success: true });
    expect((await only()).informed_by).toBe(BOB.id);
    const audit = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(audit.at(-1)?.details).toEqual({ name: "Rusu Vasile", arrest_days: 10, informed: true });
  });

  it("doar adminul șterge", async () => {
    await c.saveContravener(db, ANA, null, hotarare());
    const row = await only();
    expect(await c.deleteContravener(db, ANA, row.id)).toEqual({ error: "Însemnarea nu există sau nu ai dreptul." });
    expect(await c.deleteContravener(db, ADMIN, row.id)).toEqual({ success: true });
  });
});
