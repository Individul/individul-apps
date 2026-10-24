import type { Actor } from "@/lib/acl";
import type { Db } from "@/lib/db";
import { adminIds, createNotifications } from "@/lib/notify-core";
import {
  recipientsFor,
  observersFor,
  messageFor,
  observerMessageFor,
} from "@/lib/notifications";
import type { NotificationType } from "@/lib/types";

export async function notify(
  db: Db,
  actor: Actor,
  type: NotificationType,
  task: { id: string; title: string; assignee_id: string | null; created_by: string },
  statusLabel?: string,
  /**
   * Adminii primesc copie de observator. Se trece pe `false` doar când aceeași
   * acțiune le trimite deja altă notificare (ex. „created" la creare).
   */
  includeAdmins = true,
): Promise<void> {
  const direct = recipientsFor(type, task, actor.id);
  // best-effort: notificările nu trebuie să blocheze niciodată acțiunea de bază.
  try {
    const observers = includeAdmins ? observersFor(await adminIds(db), actor.id, direct) : [];
    if (direct.length === 0 && observers.length === 0) return;

    const send = (recipients: string[], message: string) =>
      createNotifications(db, actor, {
        recipients,
        type,
        // la ștergere, sarcina nu mai există → link mort; nu referi un id inexistent (FK).
        taskId: type === "deleted" ? null : task.id,
        message,
      });

    if (direct.length) await send(direct, messageFor(type, task.title, statusLabel));
    if (observers.length) {
      await send(observers, observerMessageFor(type, task.title, statusLabel));
    }
  } catch {
    // ignorat intenționat: o notificare pierdută nu anulează acțiunea făcută.
  }
}
