import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { markObligationDone, undoObligationDone } from "./obligations";
import { ANA, BOB, seedPeople } from "./test-helpers";

let db: Db;
let dispose: () => Promise<void>;
const OBL = "11111111-1111-4111-8111-111111111111";

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  await seedPeople(db);
  await db.insert(s.obligations).values({ id: OBL, title: "Darea de seamă lunară", kind: "lunar_ultima_zi" });
});
afterAll(() => dispose());
beforeEach(async () => {
  await db.delete(s.auditLog);
  await db.delete(s.obligationCompletions);
});

describe("informările periodice", () => {
  it("fără sesiune nu se bifează nimic", async () => {
    expect(await markObligationDone(db, null, OBL, "2026-09-30")).toEqual({ error: "Neautentificat." });
    expect(await undoObligationDone(db, null, OBL)).toEqual({ error: "Neautentificat." });
  });

  it("orice membru bifează; a doua bifă pe același termen e refuzată", async () => {
    expect(await markObligationDone(db, ANA, OBL, "2026-09-30")).toEqual({ success: true });
    expect(await markObligationDone(db, BOB, OBL, "2026-09-30")).toEqual({ error: "Termenul e deja bifat." });
  });

  it("anularea scoate termenul cel mai mare și o jurnalizează cu titlul", async () => {
    await markObligationDone(db, ANA, OBL, "2026-08-31");
    await markObligationDone(db, ANA, OBL, "2026-09-30");
    expect(await undoObligationDone(db, BOB, OBL)).toEqual({ success: true, removed: "2026-09-30" });
    const audit = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(audit.map((r) => [r.action, r.details])).toEqual([
      ["INSERT", { title: "Darea de seamă lunară", due_date: "2026-08-31" }],
      ["INSERT", { title: "Darea de seamă lunară", due_date: "2026-09-30" }],
      ["DELETE", { title: "Darea de seamă lunară", due_date: "2026-09-30" }],
    ]);
    expect(await undoObligationDone(db, BOB, OBL)).toMatchObject({ removed: "2026-08-31" });
    expect(await undoObligationDone(db, BOB, OBL)).toEqual({ error: "Nu există nicio bifă de scos." });
  });
});
