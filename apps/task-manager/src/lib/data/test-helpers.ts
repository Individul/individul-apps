/**
 * Oamenii din teste: un admin și doi membri, cu conturi și profiluri.
 * Doar pentru teste.
 */

import { asc, eq } from "drizzle-orm";

import type { Actor } from "@/lib/acl";
import type { Db } from "@/lib/db";
import { auditLog, notifications, profiles, users } from "@/lib/db/schema";

export const ADMIN: Actor = { id: "00000000-0000-4000-8000-000000000001", name: "Admin Ion", isAdmin: true };
export const ANA: Actor = { id: "00000000-0000-4000-8000-000000000002", name: "Ana Popa", isAdmin: false };
export const BOB: Actor = { id: "00000000-0000-4000-8000-000000000003", name: "Bob Rusu", isAdmin: false };

export async function seedPeople(db: Db): Promise<void> {
  for (const a of [ADMIN, ANA, BOB]) {
    await db.insert(users).values({ id: a.id, email: `${a.id}@intern.local`, passwordHash: "!" });
    await db.insert(profiles).values({ id: a.id, full_name: a.name, role: a.isAdmin ? "admin" : "member" });
  }
}

/** Jurnalul în ordinea scrierii. */
export function auditRows(db: Db) {
  return db.select().from(auditLog).orderBy(asc(auditLog.created_at), asc(auditLog.id));
}

export function notificationsOf(db: Db, userId: string) {
  return db.select().from(notifications).where(eq(notifications.user_id, userId));
}
