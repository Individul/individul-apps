import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { saveRelease } from "./releases";
import { ANA, BOB, seedPeople } from "./test-helpers";

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  await seedPeople(db);
});
afterAll(() => dispose());
beforeEach(async () => {
  await db.delete(s.auditLog);
  await db.delete(s.releases);
});

describe("eliberările", () => {
  it("fără sesiune nu se scrie nimic", async () => {
    expect(await saveRelease(db, null, "2026-10-01", "3", "")).toEqual({ error: "Neautentificat." });
  });

  it("câmpul gol nu devine zero; zero e valid", async () => {
    expect((await saveRelease(db, ANA, "2026-10-01", "", "")).error).toMatch(/scrie 0/);
    expect(await saveRelease(db, ANA, "2026-10-01", "0", "")).toEqual({ success: true });
  });

  it("a doua salvare corectează ziua și spune UPDATE în jurnal, cu cifra veche și nouă", async () => {
    await saveRelease(db, ANA, "2026-10-01", "3", "");
    await saveRelease(db, BOB, "2026-10-01", "5", "notă");
    const rows = await db.select().from(s.releases);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ count: 5, created_by: ANA.id, updated_by: BOB.id, note: "notă" });
    const audit = await db.select().from(s.auditLog).orderBy(sql`rowid`);
    expect(audit.map((r) => [r.action, r.details])).toEqual([
      ["INSERT", { release_date: "2026-10-01", count: 3 }],
      ["UPDATE", { release_date: "2026-10-01", count: 5, count_from: 3, count_to: 5 }],
    ]);
  });
});
