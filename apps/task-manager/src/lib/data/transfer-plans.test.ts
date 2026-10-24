import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { COURTS } from "@/lib/courts";
import * as p from "./transfer-plans";
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
  await db.delete(s.transferPlans);
});

const plan = (over: Partial<p.PlanInput> = {}): p.PlanInput => ({
  last_name: "Ciobanu",
  first_name: "Petru",
  basis: "sedinta",
  court: COURTS[0],
  institution: "3",
  hearing_date: "2026-11-02",
  decision_date: "",
  ruling_date: "",
  note: "",
  ...over,
});

async function only() {
  const rows = await db.select().from(s.transferPlans);
  expect(rows).toHaveLength(1);
  return rows[0];
}

describe("planificarea transferurilor", () => {
  it("fără sesiune nu se scrie nimic", async () => {
    expect(await p.savePlan(db, null, null, plan())).toEqual({ error: "Neautentificat." });
  });

  it("mutarea ședinței se jurnalizează cu data veche și nouă", async () => {
    await p.savePlan(db, ANA, null, plan());
    const row = await only();
    expect(await p.savePlan(db, BOB, row.id, plan({ hearing_date: "2026-11-09" }))).toEqual({ success: true });
    const audit = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(audit[1].details).toEqual({
      name: "Ciobanu Petru",
      court: COURTS[0],
      hearing_date: "2026-11-09",
      hearing_from: "2026-11-02",
      hearing_to: "2026-11-09",
    });
  });

  it("termenul de 30 de zile își păstrează ziua de start la o corectură", async () => {
    await p.savePlan(db, ANA, null, plan({ basis: "termen30", hearing_date: "", ruling_date: "2026-10-01" }));
    const row = await only();
    await db.update(s.transferPlans).set({ term_start: "2026-10-02" });
    await p.savePlan(db, ANA, row.id, plan({ basis: "termen30", hearing_date: "", ruling_date: "2026-10-01", note: "x" }));
    expect((await only()).term_start).toBe("2026-10-02");
  });

  it("înștiințarea ține minte ședința, iar încheierea se jurnalizează", async () => {
    await p.savePlan(db, ANA, null, plan());
    const row = await only();
    expect(await p.setPlanNotified(db, BOB, row.id, true)).toEqual({ success: true });
    expect((await only()).notified_hearing_date).toBe("2026-11-02");
    expect(await p.setPlanDone(db, BOB, row.id, true)).toEqual({ success: true });
    const audit = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(audit[1].details).toMatchObject({ notified_to: true, notified_for_hearing: "2026-11-02" });
    expect(audit[2].details).toMatchObject({ done_to: true });
  });

  it("doar adminul șterge", async () => {
    await p.savePlan(db, ANA, null, plan());
    const row = await only();
    expect(await p.deletePlan(db, ANA, row.id)).toEqual({ error: "Însemnarea nu există sau nu ai dreptul." });
    expect(await p.deletePlan(db, ADMIN, row.id)).toEqual({ success: true });
  });
});
