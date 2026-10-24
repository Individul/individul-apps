import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import * as h from "./hearings";
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
  await db.delete(s.hearings);
});

const zi = (over: Partial<h.HearingInput> = {}): h.HearingInput => ({
  session_date: "2026-10-01",
  tc_petrecute: "2",
  tc_amanate: "1",
  ij_petrecute: "0",
  ij_amanate: "0",
  note: "",
  ...over,
});

const audit = () => db.select().from(s.auditLog).where(eq(s.auditLog.entity, "hearings")).orderBy(sql`rowid`);

describe("ședințele", () => {
  it("fără sesiune nu se scrie nimic", async () => {
    expect(await h.saveHearing(db, null, zi())).toEqual({ error: "Neautentificat." });
    expect(await db.select().from(s.hearings)).toEqual([]);
  });

  it("orice membru deschide ziua; a doua salvare o corectează, păstrând cine a deschis-o", async () => {
    expect(await h.saveHearing(db, ANA, zi())).toEqual({ success: true });
    expect(await h.saveHearing(db, BOB, zi({ ij_amanate: "4" }))).toEqual({ success: true });
    const rows = await db.select().from(s.hearings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ created_by: ANA.id, updated_by: BOB.id, total_general: 7 });
    expect(rows[0].updated_at >= rows[0].created_at).toBe(true);
  });

  it("jurnalul: totalul vechi și cel nou, ca triggerul", async () => {
    await h.saveHearing(db, ANA, zi());
    await h.saveHearing(db, BOB, zi({ ij_amanate: "4" }));
    const rows = await audit();
    expect(rows.map((r) => [r.action, r.details])).toEqual([
      ["INSERT", { session_date: "2026-10-01", total: 3 }],
      ["UPDATE", { session_date: "2026-10-01", total: 7, total_from: 3, total_to: 7 }],
    ]);
    expect(rows[1].actor_name).toBe("Bob Rusu");
  });

  it("refuză cifrele negative", async () => {
    expect((await h.saveHearing(db, ANA, zi({ tc_petrecute: "-1" }))).error).toMatch(/negativ/);
  });

  it("doar adminul șterge ziua", async () => {
    await h.saveHearing(db, ANA, zi());
    expect(await h.deleteHearing(db, ANA, "2026-10-01")).toEqual({
      error: "Ziua nu există sau nu ai dreptul s-o ștergi.",
    });
    expect(await h.deleteHearing(db, null, "2026-10-01")).toEqual({ error: "Neautentificat." });
    expect(await h.deleteHearing(db, ADMIN, "2026-10-01")).toEqual({ success: true });
    expect(await db.select().from(s.hearings)).toEqual([]);
    expect((await audit()).at(-1)?.action).toBe("DELETE");
  });
});
