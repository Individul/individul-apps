import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import * as d from "./defendants";
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
  await db.delete(s.defendants);
});

const om = (over: Partial<d.DefendantInput> = {}): d.DefendantInput => ({
  last_name: "Popescu",
  first_name: "Ion",
  regime: "inchis",
  established_on: "2026-09-01",
  court: "",
  case_number: "",
  preventive_measure: false,
  preventive_measure_on: "2026-09-02",
  note: "",
  ...over,
});

async function only() {
  const rows = await db.select().from(s.defendants);
  expect(rows).toHaveLength(1);
  return rows[0];
}

describe("inculpații", () => {
  it("fără sesiune nu se scrie nimic", async () => {
    expect(await d.saveDefendant(db, null, null, om())).toEqual({ error: "Neautentificat." });
  });

  it("fără măsură preventivă, data măsurii se scrie nulă", async () => {
    await d.saveDefendant(db, ANA, null, om());
    expect((await only()).preventive_measure_on).toBeNull();
  });

  it("trecerea la condamnat și înapoi, cu jurnalul stării", async () => {
    await d.saveDefendant(db, ANA, null, om());
    const row = await only();
    expect((await d.markConvicted(db, BOB, row.id, "3 august")).error).toMatch(/AAAA-LL-ZZ/);
    expect(await d.markConvicted(db, BOB, row.id, "2026-10-01")).toEqual({ success: true });
    expect(await d.undoConvicted(db, BOB, row.id)).toEqual({ success: true });
    const audit = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(audit.map((r) => r.details)).toEqual([
      { name: "Popescu Ion", regime: "inchis", status: "inculpat" },
      { name: "Popescu Ion", regime: "inchis", status: "condamnat", status_from: "inculpat", status_to: "condamnat" },
      { name: "Popescu Ion", regime: "inchis", status: "inculpat", status_from: "condamnat", status_to: "inculpat" },
    ]);
  });

  it("schimbarea regimului se jurnalizează", async () => {
    await d.saveDefendant(db, ANA, null, om());
    const row = await only();
    await d.saveDefendant(db, BOB, row.id, om({ regime: "semiinchis" }));
    const audit = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(audit[1].details).toEqual({
      name: "Popescu Ion",
      regime: "semiinchis",
      status: "inculpat",
      regime_from: "inchis",
      regime_to: "semiinchis",
    });
  });

  it("doar adminul șterge", async () => {
    await d.saveDefendant(db, ANA, null, om());
    const row = await only();
    expect(await d.deleteDefendant(db, ANA, row.id)).toEqual({ error: "Însemnarea nu există sau nu ai dreptul." });
    expect(await d.deleteDefendant(db, ADMIN, row.id)).toEqual({ success: true });
  });
});
