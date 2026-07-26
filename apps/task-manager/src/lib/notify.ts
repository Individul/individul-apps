import { createClient } from "@/lib/supabase/server";
import { recipientsFor, messageFor } from "@/lib/notifications";
import type { NotificationType } from "@/lib/types";

export async function notify(
  type: NotificationType,
  task: { id: string; title: string; assignee_id: string | null; created_by: string },
  actorId: string,
  statusLabel?: string,
): Promise<void> {
  const recipients = recipientsFor(type, task, actorId);
  if (recipients.length === 0) return;
  // best-effort: notificările nu trebuie să blocheze niciodată acțiunea de bază.
  try {
    const supabase = createClient();
    await supabase.rpc("create_notifications", {
      p_recipients: recipients,
      p_type: type,
      // la ștergere, sarcina nu mai există → link mort; nu referi un id inexistent (FK).
      p_task_id: type === "deleted" ? null : task.id,
      p_message: messageFor(type, task.title, statusLabel),
    });
  } catch {
    // ignorat intenționat (ex: migrarea 0008 neaplicată, eroare de rețea).
  }
}
