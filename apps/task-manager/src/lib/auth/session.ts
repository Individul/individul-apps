/**
 * Sesiunile: un jeton aleator în cookie, amprenta lui SHA-256 în D1.
 *
 * Fără cheie de semnare și fără JWT: jetonul nu poartă nimic în el, iar baza
 * spune dacă e valabil. Așa o sesiune se poate închide pe loc (ștergi rândul),
 * iar o copie a bazei nu deschide nimic — din amprentă nu se reface jetonul.
 *
 * Funcțiile primesc baza ca parametru: nu știu de Next, deci se testează pe un
 * D1 adevărat, fără cookie-uri.
 */

import { and, eq, lt, ne, sql } from "drizzle-orm";

import type { Db } from "@/lib/db";
import { profiles, sessions, users } from "@/lib/db/schema";

export const SESSION_COOKIE = "sarcini_sesiune";

const DAY = 24 * 60 * 60 * 1000;
/** Cât ține o sesiune nefolosită. */
export const SESSION_DAYS = 30;
/**
 * Sub cât rămas se prelungește. Prelungirea scrie în bază, deci nu se face la
 * fiecare cerere, ci cel mult o dată la vreo cincisprezece zile de folosire.
 */
const RENEW_BELOW_DAYS = 15;

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

/** 32 de octeți aleatori, în base64url: de negăsit prin încercări. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export interface SessionResult {
  userId: string;
  expiresAt: Date;
  /** Adevărat când termenul tocmai s-a mutat: cookie-ul trebuie retrimis. */
  renewed: boolean;
}

export async function createSession(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY);
  await db.insert(sessions).values({
    id: await hashToken(token),
    userId,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });
  return { token, expiresAt };
}

/**
 * Sesiunea jetonului, sau `null` dacă nu există ori a expirat.
 *
 * `renew: false` pentru citirile din randare: acolo nu se pot scrie cookie-uri,
 * deci o prelungire în bază ar lăsa browserul cu un cookie mai scurt decât
 * sesiunea. Prelungirea o face doar middleware-ul, care poate trimite cookie-ul.
 */
export async function validateSession(
  db: Db,
  token: string | undefined,
  { now = new Date(), renew = false }: { now?: Date; renew?: boolean } = {},
): Promise<SessionResult | null> {
  if (!token) return null;
  const id = await hashToken(token);
  const row = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, id))
    .get();
  if (!row) return null;

  const expiresAt = new Date(row.expiresAt);
  if (expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  if (renew && expiresAt.getTime() - now.getTime() < RENEW_BELOW_DAYS * DAY) {
    const next = new Date(now.getTime() + SESSION_DAYS * DAY);
    await db.update(sessions).set({ expiresAt: next.toISOString() }).where(eq(sessions.id, id));
    return { userId: row.userId, expiresAt: next, renewed: true };
  }
  return { userId: row.userId, expiresAt, renewed: false };
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, await hashToken(token)));
}

/**
 * Închide celelalte sesiuni ale omului, păstrând-o pe cea curentă.
 *
 * La schimbarea parolei: cine o schimbă pentru că a scăpat-o vrea ca un
 * calculator uitat deschis să nu mai intre.
 */
export async function deleteOtherSessions(db: Db, userId: string, keepToken: string | undefined) {
  const keep = keepToken ? await hashToken(keepToken) : "";
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keep)));
}

/** Curățenie: sesiunile expirate nu mai deschid nimic, dar ocupă loc. */
export async function deleteExpiredSessions(db: Db, now = new Date()) {
  await db.delete(sessions).where(lt(sessions.expiresAt, now.toISOString()));
}

/**
 * Contul după numele de utilizator sau după adresă.
 *
 * Fără „@" e nume de utilizator, căutat fără să conteze literele mari — ca
 * `email_for_login` din Supabase. Cu „@" e adresa contului.
 */
export async function findLoginUser(
  db: Db,
  identifier: string,
): Promise<{ id: string; passwordHash: string } | null> {
  const ident = identifier.trim().toLowerCase();
  if (!ident) return null;
  const row = ident.includes("@")
    ? await db
        .select({ id: users.id, passwordHash: users.passwordHash })
        .from(users)
        .where(sql`lower(${users.email}) = ${ident}`)
        .get()
    : await db
        .select({ id: users.id, passwordHash: users.passwordHash })
        .from(users)
        .innerJoin(profiles, eq(profiles.id, users.id))
        .where(sql`lower(${profiles.username}) = ${ident}`)
        .get();
  return row ?? null;
}
