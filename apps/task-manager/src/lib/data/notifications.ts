/**
 * Notificările celui conectat: citire, marcare, verificarea celor noi.
 *
 * Toate filtrează pe `user_id = me` — regula „notifications select/update own"
 * din 0008. Pe Supabase, `update({ read: true }).eq("read", false)` atingea
 * doar ale tale fiindcă baza le ascundea pe ale altora; pe D1 aceeași
 * interogare fără filtru le-ar marca citite pe ale tuturor.
 */

import { and, desc, eq, gt, sql } from "drizzle-orm";

import { NEAUTENTIFICAT, type Actor } from "@/lib/acl";
import type { Db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import type { Notification } from "@/lib/types";

export async function markRead(db: Db, me: Actor | null, id: string): Promise<{ error?: string }> {
  if (!me) return { error: NEAUTENTIFICAT };
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.user_id, me.id)));
  return {};
}

export async function markAllRead(db: Db, me: Actor | null): Promise<{ error?: string }> {
  if (!me) return { error: NEAUTENTIFICAT };
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.user_id, me.id), eq(notifications.read, false)));
  return {};
}

/**
 * Ce a sosit după `since`, plus numărul celor necitite — ce cere clopoțelul la
 * fiecare verificare. Înlocuiește abonamentul în timp real din Supabase.
 */
export async function pollNotifications(
  db: Db,
  me: Actor | null,
  since: string | null,
  limit = 20,
): Promise<{ fresh: Notification[]; unread: number } | { error: string }> {
  if (!me) return { error: NEAUTENTIFICAT };
  const [fresh, unread] = await db.batch([
    db
      .select()
      .from(notifications)
      .where(
        since
          ? and(eq(notifications.user_id, me.id), gt(notifications.created_at, since))
          : eq(notifications.user_id, me.id),
      )
      .orderBy(desc(notifications.created_at), sql`${notifications}.rowid desc`)
      .limit(limit),
    db
      .select({ n: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.user_id, me.id), eq(notifications.read, false))),
  ]);
  return { fresh: fresh as Notification[], unread: unread[0]?.n ?? 0 };
}
