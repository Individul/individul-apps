import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { checkLogin, DATE_GRESITE } from "./login";
import { verifyPassword } from "./password";
import {
  createSession,
  deleteExpiredSessions,
  deleteOtherSessions,
  deleteSession,
  hashToken,
  SESSION_DAYS,
  validateSession,
} from "./session";

const DAY = 24 * 60 * 60 * 1000;
let db: Db;
let dispose: () => Promise<void>;

/**
 * O amprentă în forma celor din Supabase: `$2a$`, cost 10. Generată aici, nu
 * copiată din bază — amprentele adevărate nu au ce căuta într-un test.
 */
const PAROLA = "parolă-veche-123";
let amprentaSupabase: string;

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  // bcryptjs scrie `$2b$`; pentru o parolă obișnuită `$2a$` dă aceeași
  // amprentă, deci prefixul schimbat face exact forma importată din Supabase.
  amprentaSupabase = bcrypt.hashSync(PAROLA, 10).replace(/^\$2b\$/, "$2a$");
  await db.insert(s.users).values({ id: "u-ana", email: "ana@intern.local", passwordHash: amprentaSupabase });
  await db.insert(s.profiles).values({ id: "u-ana", full_name: "Ana", username: "Ana.Popa" });
});
afterAll(() => dispose());

describe("parolele", () => {
  it("amprenta are forma celor din Supabase", () => {
    expect(amprentaSupabase).toMatch(/^\$2a\$10\$/);
  });

  it("verifică o amprentă $2a$ cu parola bună și o refuză pe cea greșită", async () => {
    expect(await verifyPassword(PAROLA, amprentaSupabase)).toBe(true);
    expect(await verifyPassword("alta", amprentaSupabase)).toBe(false);
  });

  it("un cont fără amprentă („!” de la import) nu se deschide cu nimic", async () => {
    expect(await verifyPassword("", "!")).toBe(false);
    expect(await verifyPassword("!", "!")).toBe(false);
  });
});

describe("logarea", () => {
  it("după numele de utilizator, fără să conteze literele mari", async () => {
    expect(await checkLogin(db, "ana.popa", PAROLA)).toEqual({ userId: "u-ana" });
    expect(await checkLogin(db, "ANA.POPA", PAROLA)).toEqual({ userId: "u-ana" });
  });

  it("după adresă", async () => {
    expect(await checkLogin(db, "Ana@intern.local", PAROLA)).toEqual({ userId: "u-ana" });
  });

  it("parola greșită și numele inexistent primesc același mesaj", async () => {
    expect(await checkLogin(db, "ana.popa", "gresit")).toEqual({ error: DATE_GRESITE });
    expect(await checkLogin(db, "nimeni", PAROLA)).toEqual({ error: DATE_GRESITE });
  });
});

describe("sesiunile", () => {
  it("în bază stă amprenta jetonului, nu jetonul", async () => {
    const { token } = await createSession(db, "u-ana");
    const rows = await db.select().from(s.sessions).where(eq(s.sessions.userId, "u-ana"));
    expect(rows.map((r) => r.id)).toContain(await hashToken(token));
    expect(rows.map((r) => r.id)).not.toContain(token);
  });

  it("o sesiune valabilă deschide; un jeton necunoscut nu", async () => {
    const { token } = await createSession(db, "u-ana");
    expect((await validateSession(db, token))?.userId).toBe("u-ana");
    expect(await validateSession(db, "jeton-inventat")).toBeNull();
    expect(await validateSession(db, undefined)).toBeNull();
  });

  it("o sesiune expirată e refuzată și ștearsă", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    const { token } = await createSession(db, "u-ana", t0);
    const dupa = new Date(t0.getTime() + (SESSION_DAYS + 1) * DAY);
    expect(await validateSession(db, token, { now: dupa })).toBeNull();
    const id = await hashToken(token);
    expect(await db.select().from(s.sessions).where(eq(s.sessions.id, id))).toEqual([]);
  });

  it("se prelungește doar când i-a rămas puțin și doar la cerere (middleware)", async () => {
    const t0 = new Date("2026-03-01T00:00:00Z");
    const { token } = await createSession(db, "u-ana", t0);
    const curand = new Date(t0.getTime() + 2 * DAY);
    expect((await validateSession(db, token, { now: curand, renew: true }))?.renewed).toBe(false);

    const tarziu = new Date(t0.getTime() + 20 * DAY);
    expect((await validateSession(db, token, { now: tarziu, renew: false }))?.renewed).toBe(false);
    const prelungita = await validateSession(db, token, { now: tarziu, renew: true });
    expect(prelungita?.renewed).toBe(true);
    expect(prelungita!.expiresAt.getTime()).toBe(tarziu.getTime() + SESSION_DAYS * DAY);
  });

  it("ieșirea închide sesiunea; schimbarea parolei le închide pe celelalte", async () => {
    const a = await createSession(db, "u-ana");
    const b = await createSession(db, "u-ana");
    await deleteOtherSessions(db, "u-ana", a.token);
    expect(await validateSession(db, a.token)).not.toBeNull();
    expect(await validateSession(db, b.token)).toBeNull();
    await deleteSession(db, a.token);
    expect(await validateSession(db, a.token)).toBeNull();
  });

  it("cronul șterge doar sesiunile expirate", async () => {
    const t0 = new Date("2026-05-01T00:00:00Z");
    const veche = await createSession(db, "u-ana", t0);
    const noua = await createSession(db, "u-ana", new Date(t0.getTime() + 20 * DAY));
    await deleteExpiredSessions(db, new Date(t0.getTime() + (SESSION_DAYS + 1) * DAY));
    const ids = (await db.select().from(s.sessions)).map((r) => r.id);
    expect(ids).not.toContain(await hashToken(veche.token));
    expect(ids).toContain(await hashToken(noua.token));
  });

  it("ștergerea contului închide toate sesiunile lui", async () => {
    await db.insert(s.users).values({ id: "u-bob", email: "bob@intern.local", passwordHash: "!" });
    const { token } = await createSession(db, "u-bob");
    await db.delete(s.users).where(eq(s.users.id, "u-bob"));
    expect(await validateSession(db, token)).toBeNull();
  });
});
