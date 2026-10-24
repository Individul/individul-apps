/**
 * `create_notifications` din Postgres (0015), mutată în aplicație.
 *
 * Funcția din bază nu avea încredere în lista de destinatari primită: păstra
 * doar adminii și oamenii legați de sarcină sau de petiție (autor ori
 * responsabil), scotea autorul acțiunii și nu scria nimic fără sesiune. Aici
 * filtrul rămâne același, ca o greșeală în cine cheamă să nu poată trimite
 * notificări unor străini de lucrare.
 */

import { and, eq, inArray } from "drizzle-orm";

import type { Actor } from "@/lib/acl";
import type { Db } from "@/lib/db";
import { notifications, petitions, profiles, tasks } from "@/lib/db/schema";
import type { NotificationType } from "@/lib/types";

export interface NotificationRequest {
  recipients: (string | null | undefined)[];
  type: NotificationType;
  taskId: string | null;
  petitionId?: string | null;
  message: string;
}

export async function createNotifications(
  db: Db,
  actor: Actor | null,
  req: NotificationRequest,
): Promise<number> {
  if (!actor) return 0;
  const candidates = [
    ...new Set(req.recipients.filter((r): r is string => !!r && r !== actor.id)),
  ];
  if (candidates.length === 0) return 0;

  let valid = candidates;
  const petitionId = req.petitionId ?? null;
  if (petitionId || req.taskId) {
    const admins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(inArray(profiles.id, candidates), eq(profiles.role, "admin")));
    const owner = petitionId
      ? await db
          .select({ created_by: petitions.created_by, assignee_id: petitions.assignee_id })
          .from(petitions)
          .where(eq(petitions.id, petitionId))
          .get()
      : await db
          .select({ created_by: tasks.created_by, assignee_id: tasks.assignee_id })
          .from(tasks)
          .where(eq(tasks.id, req.taskId!))
          .get();
    const allowed = new Set(admins.map((a) => a.id));
    if (owner) {
      allowed.add(owner.created_by);
      if (owner.assignee_id) allowed.add(owner.assignee_id);
    }
    valid = candidates.filter((r) => allowed.has(r));
  }
  if (valid.length === 0) return 0;

  const at = new Date().toISOString();
  await db.insert(notifications).values(
    valid.map((user_id) => ({
      id: crypto.randomUUID(),
      user_id,
      type: req.type,
      task_id: req.taskId,
      petition_id: petitionId,
      actor_id: actor.id,
      actor_name: actor.name,
      message: req.message,
      created_at: at,
    })),
  );
  return valid.length;
}

/** Id-urile adminilor, pentru copiile de observator. */
export async function adminIds(db: Db): Promise<string[]> {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.role, "admin"));
  return rows.map((r) => r.id);
}

