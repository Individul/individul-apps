import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createTestDb } from "./test-db";
import { isUniqueViolation, type Db } from "./index";
import * as s from "./schema";

/*
 * Regulile pe care Postgres le ținea în bază și pe care D1 trebuie să le țină
 * la fel. Dacă una cade, aplicația ar primi date pe care Postgres le refuza.
 */

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  await db.insert(s.users).values({ id: "u1", email: "ana@intern.local", passwordHash: "!" });
  await db.insert(s.profiles).values({ id: "u1", full_name: "Ana", username: "Ana" });
});
afterAll(() => dispose());

describe("schema D1", () => {
  it("termenul petiției: data înregistrării + 27 de zile", async () => {
    await db.insert(s.petitions).values({
      id: "p1",
      number: "M-1/26",
      petitioner: "X",
      received_date: "2026-10-01",
      created_by: "u1",
    });
    const [p] = await db.select().from(s.petitions).where(eq(s.petitions.id, "p1"));
    expect(p.response_deadline).toBe("2026-10-28");
  });

  it("totalurile ședințelor și ale transferurilor se calculează singure", async () => {
    await db.insert(s.hearings).values({ id: "h1", session_date: "2026-10-01", tc_petrecute: 2, ij_amanate: 3 });
    const [h] = await db.select().from(s.hearings);
    expect([h.tc_total, h.ij_total, h.total_general]).toEqual([2, 3, 5]);

    await db.insert(s.transfers).values({ id: "t1", transfer_date: "2026-10-01", institution: 3, plecati: 4, sositi: 1 });
    const [t] = await db.select().from(s.transfers);
    expect(t.total).toBe(5);
  });

  it("refuză un profil fără cont", async () => {
    await expect(db.insert(s.profiles).values({ id: "nimeni" })).rejects.toThrow();
  });

  it("refuză penitenciarul 6 (al nostru)", async () => {
    await expect(
      db.insert(s.transfers).values({ id: "t6", transfer_date: "2026-10-02", institution: 6 }),
    ).rejects.toThrow();
  });

  it("refuză un plan de transfer fără temei complet", async () => {
    await expect(
      db.insert(s.transferPlans).values({ id: "x", last_name: "A", first_name: "B", institution: 3, basis: "sedinta" }),
    ).rejects.toThrow();
  });

  it("numele de utilizator e unic fără să conteze literele mari", async () => {
    await db.insert(s.users).values({ id: "u2", email: "b@intern.local", passwordHash: "!" });
    const err = await db
      .insert(s.profiles)
      .values({ id: "u2", username: "ana" })
      .then(() => null, (e: unknown) => e);
    expect(isUniqueViolation(err)).toBe(true);
  });

  it("valorile boolean și JSON se întorc cu tipul lor", async () => {
    await db.insert(s.auditLog).values({ action: "INSERT", entity: "tasks", details: { a: 1 } });
    const [a] = await db.select().from(s.auditLog);
    expect(a.details).toEqual({ a: 1 });
    expect(a.created_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);

    const [tp] = await db
      .insert(s.transferPlans)
      .values({ last_name: "A", first_name: "B", institution: 3, basis: "decizie", decision_date: "2026-10-01" })
      .returning();
    expect(tp.done).toBe(false);
  });

  it("ștergerea contului șterge profilul și ce a creat, în cascadă", async () => {
    await db.delete(s.users).where(eq(s.users.id, "u1"));
    expect(await db.select().from(s.profiles).where(eq(s.profiles.id, "u1"))).toEqual([]);
    expect(await db.select().from(s.petitions)).toEqual([]);
  });
});
