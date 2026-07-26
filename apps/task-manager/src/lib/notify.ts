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
  const supabase = createClient();
  await supabase.rpc("create_notifications", {
    p_recipients: recipients,
    p_type: type,
    p_task_id: task.id,
    p_message: messageFor(type, task.title, statusLabel),
  });
  // best-effort: nu bloca acțiunea dacă rpc eșuează
}
