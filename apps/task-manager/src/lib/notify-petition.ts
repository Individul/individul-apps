import type { Actor } from "@/lib/acl";
import type { Db } from "@/lib/db";
import { adminIds, createNotifications } from "@/lib/notify-core";
import { recipientsFor, observersFor } from "@/lib/notifications";
import { petitionMessageFor, petitionObserverMessageFor } from "@/lib/petition-notifications";
import type { NotificationType } from "@/lib/types";

export async function notifyPetition(
  db: Db,
  actor: Actor,
  type: NotificationType,
  petition: { id: string; number: string; assignee_id: string | null; created_by: string },
  statusLabel?: string,
  includeAdmins = true,
): Promise<void> {
  const direct = recipientsFor(type, petition, actor.id);
  // best-effort: notificările nu trebuie să blocheze niciodată acțiunea de bază.
  try {
    const observers = includeAdmins ? observersFor(await adminIds(db), actor.id, direct) : [];
    if (direct.length === 0 && observers.length === 0) return;

    const send = (recipients: string[], message: string) =>
      createNotifications(db, actor, {
        recipients,
        type,
        taskId: null,
        // la ștergere petiția nu mai există → cheia străină ar pica; fără legătură.
        petitionId: type === "deleted" ? null : petition.id,
        message,
      });

    if (direct.length) {
      await send(direct, petitionMessageFor(type, petition.number, statusLabel));
    }
    if (observers.length) {
      await send(observers, petitionObserverMessageFor(type, petition.number, statusLabel));
    }
  } catch {
    // ignorat intenționat: o notificare pierdută nu anulează acțiunea făcută.
  }
}
