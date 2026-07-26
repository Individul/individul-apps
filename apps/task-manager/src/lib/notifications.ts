import type { NotificationType } from "./types";

type TaskRef = { assignee_id: string | null; created_by: string };

export function recipientsFor(type: NotificationType, task: TaskRef, actorId: string): string[] {
  if (type === "assigned") {
    return task.assignee_id && task.assignee_id !== actorId ? [task.assignee_id] : [];
  }
  const set = new Set<string>();
  if (task.assignee_id) set.add(task.assignee_id);
  set.add(task.created_by);
  set.delete(actorId);
  return [...set];
}

export function messageFor(type: NotificationType, title: string, statusLabel?: string): string {
  switch (type) {
    case "assigned": return `Ți-a fost atribuită sarcina „${title}"`;
    case "comment": return `Comentariu nou la „${title}"`;
    case "status": return `Starea sarcinii „${title}" s-a schimbat${statusLabel ? `: ${statusLabel}` : ""}`;
    case "edited": return `Sarcina „${title}" a fost modificată`;
    case "deleted": return `Sarcina „${title}" a fost ștearsă`;
  }
}
