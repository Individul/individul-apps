import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { checkLogin } from "@/lib/auth/login";
import { createSession, validateSession } from "@/lib/auth/session";
import * as account from "./account";
import * as notif from "./notifications";
import { ADMIN, ANA, BOB, seedPeople } from "./test-helpers";

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  await seedPeople(db);
});
afterAll(() => dispose());

describe("conturile noi", () => {
  it("le creează doar adminul", async () => {
    const input = { full_name: "Ion Nou", username: "ion.nou", password: "parola-buna-1" };
    expect(await account.createUser(db, ANA, input)).toEqual({ error: "Doar adminul poate crea utilizatori." });
    expect(await account.createUser(db, null, input)).toEqual({ error: "Neautentificat." });
    expect(await account.createUser(db, ADMIN, input)).toEqual({ success: true });
  });

  it("contul nou se loghează cu parola dată și e membru", async () => {
    const res = await checkLogin(db, "ion.nou", "parola-buna-1");
    expect("userId" in res).toBe(true);
    const id = (res as { userId: string }).userId;
    const profile = await db.select().from(s.profiles).where(eq(s.profiles.id, id)).get();
    expect(profile).toMatchObject({ full_name: "Ion Nou", username: "ion.nou", role: "member" });
    const user = await db.select().from(s.users).where(eq(s.users.id, id)).get();
    expect(user?.email).toBe("ion.nou@intern.local");
  });

  it("numele de utilizator rămâne unic", async () => {
    const input = { full_name: "Altul", username: "ION.NOU", password: "parola-buna-2" };
    expect(await account.createUser(db, ADMIN, input)).toEqual({ error: "Numele de utilizator e deja folosit." });
  });

  it("refuză datele greșite înainte de orice scriere", async () => {
    expect((await account.createUser(db, ADMIN, { full_name: "", username: "x.y.z", password: "12345678" })).error).toBeTruthy();
    expect((await account.createUser(db, ADMIN, { full_name: "A", username: "a b", password: "12345678" })).error).toBeTruthy();
    expect((await account.createUser(db, ADMIN, { full_name: "A", username: "abc", password: "scurt" })).error).toBeTruthy();
  });
});

describe("rolurile", () => {
  it("le schimbă doar adminul, și nu pe al lui în jos", async () => {
    expect((await account.setUserRole(db, ANA, BOB.id, "admin")).error).toBeTruthy();
    expect((await account.setUserRole(db, ANA, ANA.id, "admin")).error).toBeTruthy();
    expect(await account.setUserRole(db, ADMIN, ADMIN.id, "member")).toEqual({ error: "Nu-ți poți retrograda propriul rol." });
    expect(await account.setUserRole(db, ADMIN, BOB.id, "admin")).toEqual({ success: true });
    const bob = await db.select().from(s.profiles).where(eq(s.profiles.id, BOB.id)).get();
    expect(bob?.role).toBe("admin");
    await account.setUserRole(db, ADMIN, BOB.id, "member");
  });

  it("schimbarea intră în jurnal ca pe vremea triggerului", async () => {
    const rows = await db
      .select()
      .from(s.auditLog)
      .where(eq(s.auditLog.entity, "profiles"))
      .orderBy(sql`rowid`);
    const last = rows.at(-1)!;
    expect(last).toMatchObject({ action: "UPDATE", entity_id: BOB.id, actor_id: ADMIN.id });
    expect(last.details).toEqual({ full_name: "Bob Rusu", role: "member" });
  });
});

describe("profilul propriu și parola", () => {
  it("fiecare își schimbă doar profilul lui", async () => {
    expect(await account.updateProfile(db, ANA, "Ana P.", "ana.p")).toEqual({ success: true });
    expect((await db.select().from(s.profiles).where(eq(s.profiles.id, ANA.id)).get())?.full_name).toBe("Ana P.");
    expect(await account.updateProfile(db, BOB, "Bob", "ana.p")).toEqual({ error: "Numele de utilizator e deja folosit." });
  });

  it("parola nouă merge, cea veche nu, iar celelalte sesiuni se închid", async () => {
    await account.createUser(db, ADMIN, { full_name: "Dan", username: "dan", password: "veche-parola-1" });
    const dan = (await checkLogin(db, "dan", "veche-parola-1")) as { userId: string };
    const actor = { id: dan.userId, name: "Dan", isAdmin: false };
    const aici = await createSession(db, dan.userId);
    const altundeva = await createSession(db, dan.userId);

    expect(await account.changePassword(db, actor, "noua-parola-1", "alta", aici.token)).toEqual({ error: "Parolele nu coincid." });
    expect(await account.changePassword(db, actor, "noua-parola-1", "noua-parola-1", aici.token)).toEqual({ success: true });

    expect("error" in (await checkLogin(db, "dan", "veche-parola-1"))).toBe(true);
    expect("userId" in (await checkLogin(db, "dan", "noua-parola-1"))).toBe(true);
    expect(await validateSession(db, aici.token)).not.toBeNull();
    expect(await validateSession(db, altundeva.token)).toBeNull();
  });
});

describe("notificările", () => {
  it("fiecare le vede și le marchează doar pe ale lui", async () => {
    const at = new Date().toISOString();
    await db.insert(s.notifications).values([
      { id: "n1", user_id: ANA.id, type: "edited", message: "pentru Ana", created_at: at },
      { id: "n2", user_id: BOB.id, type: "edited", message: "pentru Bob", created_at: at },
    ]);

    const ana = await notif.pollNotifications(db, ANA, null);
    expect("fresh" in ana && ana.fresh.map((n) => n.id)).toEqual(["n1"]);

    await notif.markAllRead(db, ANA);
    await notif.markRead(db, ANA, "n2");
    const bob = await db.select().from(s.notifications).where(eq(s.notifications.id, "n2")).get();
    expect(bob?.read).toBe(false);
    const anaRow = await db.select().from(s.notifications).where(eq(s.notifications.id, "n1")).get();
    expect(anaRow?.read).toBe(true);
  });

  it("verificarea periodică aduce doar ce a sosit după reper", async () => {
    await db.insert(s.notifications).values({
      id: "n3",
      user_id: BOB.id,
      type: "comment",
      message: "nouă",
      created_at: "2099-01-01T00:00:00.000Z",
    });
    const res = await notif.pollNotifications(db, BOB, "2098-12-31T23:59:59.000Z");
    expect("fresh" in res && res.fresh.map((n) => n.id)).toEqual(["n3"]);
    expect("unread" in res && res.unread).toBe(2);
    expect(await notif.pollNotifications(db, null, null)).toEqual({ error: "Neautentificat." });
  });
});
