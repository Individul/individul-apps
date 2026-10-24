/**
 * Contul propriu și administrarea oamenilor.
 *
 * Înlocuiește Supabase Auth (`updateUser`, `auth.admin.createUser`) și regulile
 * pe `profiles` din 0001–0005: propriul profil sau adminul; rolul doar
 * adminul (garda `profiles_role_guard`).
 */

import { eq, sql } from "drizzle-orm";

import { NEAUTENTIFICAT, canChangeRole, canManageUsers, canUpdateProfile, type Actor } from "@/lib/acl";
import { auditContext, auditInsert, profileAudit } from "@/lib/audit";
import { isUniqueViolation, type Db } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { deleteOtherSessions } from "@/lib/auth/session";
import { runBatch, type ActionResult } from "./common";

const USERNAME = /^[a-z0-9._-]{3,30}$/;
const USERNAME_INVALID = "Username invalid: 3-30 caractere, doar litere, cifre, . _ -";

export async function changePassword(
  db: Db,
  me: Actor | null,
  password: string,
  confirm: string,
  currentToken: string | undefined,
): Promise<ActionResult> {
  if (password.length < 8) return { error: "Parola trebuie să aibă minim 8 caractere." };
  if (password !== confirm) return { error: "Parolele nu coincid." };
  if (!me) return { error: NEAUTENTIFICAT };

  const hash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash: hash, updatedAt: new Date().toISOString() })
    .where(eq(users.id, me.id));
  // Cine schimbă parola pentru că a scăpat-o vrea ca un calculator uitat
  // deschis să nu mai intre; sesiunea de acum rămâne.
  await deleteOtherSessions(db, me.id, currentToken);
  return { success: true };
}

export async function updateProfile(
  db: Db,
  me: Actor | null,
  fullNameRaw: string,
  usernameRaw: string,
): Promise<ActionResult> {
  const fullName = fullNameRaw.trim();
  if (!fullName) return { error: "Numele nu poate fi gol." };
  if (fullName.length > 200) return { error: "Numele e prea lung (max 200 caractere)." };
  const username = usernameRaw.trim() ? usernameRaw.trim().toLowerCase() : null;
  if (username !== null && !USERNAME.test(username)) return { error: USERNAME_INVALID };
  if (!me) return { error: NEAUTENTIFICAT };

  const prev = await db.select().from(profiles).where(eq(profiles.id, me.id)).get();
  if (!prev || !canUpdateProfile(me, prev.id)) return { error: "Nu s-a putut actualiza profilul." };
  const next = { ...prev, full_name: fullName, username };
  try {
    await runBatch(db, [
      db.update(profiles).set({ full_name: fullName, username }).where(eq(profiles.id, me.id)),
      auditInsert(db, auditContext(me), [profileAudit("UPDATE", next)]),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Username-ul e deja folosit." };
    return { error: e instanceof Error ? e.message : "Nu s-a putut actualiza profilul." };
  }
  return { success: true };
}

export async function setUserRole(
  db: Db,
  me: Actor | null,
  userId: string,
  role: "admin" | "member",
): Promise<ActionResult> {
  if (role !== "admin" && role !== "member") return { error: "Rol invalid." };
  if (!me) return { error: NEAUTENTIFICAT };
  // Nu-ți poți retrograda propriul rol (protecție și în cod, nu doar în UI).
  if (me.id === userId && role === "member") return { error: "Nu-ți poți retrograda propriul rol." };
  if (!canChangeRole(me)) return { error: "Doar adminul poate schimba rolul." };

  const prev = await db.select().from(profiles).where(eq(profiles.id, userId)).get();
  if (!prev) return { error: "Fără permisiune sau utilizator inexistent." };
  await runBatch(db, [
    db.update(profiles).set({ role }).where(eq(profiles.id, userId)),
    auditInsert(db, auditContext(me), [profileAudit("UPDATE", { ...prev, role })]),
  ]);
  return { success: true };
}

/**
 * Un om nou, cu username și parolă. Adresa e internă (`@intern.local`), ca la
 * conturile create în Supabase — nimeni nu primește email.
 */
export async function createUser(
  db: Db,
  me: Actor | null,
  input: { full_name: string; username: string; password: string },
): Promise<ActionResult> {
  const fullName = input.full_name.trim();
  const username = input.username.trim().toLowerCase();
  const password = input.password;

  if (!fullName) return { error: "Numele e obligatoriu." };
  if (!USERNAME.test(username)) return { error: USERNAME_INVALID };
  if (password.length < 8) return { error: "Parola trebuie să aibă minim 8 caractere." };
  if (!me) return { error: NEAUTENTIFICAT };
  if (!canManageUsers(me)) return { error: "Doar adminul poate crea utilizatori." };

  // Username unic (verificare prietenoasă înainte de a crea contul).
  const taken = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = ${username}`)
    .get();
  if (taken) return { error: "Username-ul e deja folosit." };

  const ctx = auditContext(me);
  const id = crypto.randomUUID();
  const profile = { id, full_name: fullName, username, role: "member" as const, avatar_url: null, created_at: ctx.at };
  try {
    // Contul și profilul deodată: nu mai poate rămâne un cont fără profil,
    // cum se putea între `createUser` și `update` în Supabase.
    await runBatch(db, [
      db.insert(users).values({
        id,
        email: `${username}@intern.local`,
        passwordHash: await hashPassword(password),
        createdAt: ctx.at,
        updatedAt: ctx.at,
      }),
      db.insert(profiles).values(profile),
      auditInsert(db, ctx, [profileAudit("INSERT", profile)]),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Username-ul e deja folosit." };
    return { error: e instanceof Error ? e.message : "Nu s-a putut crea utilizatorul." };
  }
  return { success: true };
}
