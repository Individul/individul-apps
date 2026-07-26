import { parseISO } from "date-fns";
import type { Task, TaskStatus, TaskPriority } from "./types";

export const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export type DueFilter = "overdue" | "soon";

export interface TaskFilter {
  status?: TaskStatus;
  assigneeId?: string;
  priority?: TaskPriority;
  due?: DueFilter;
  tagId?: string;
}

export function filterTasks(tasks: Task[], f: TaskFilter): Task[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const soonLimit = new Date(startOfToday);
  soonLimit.setDate(soonLimit.getDate() + 7);

  return tasks.filter((t) => {
    if (f.status && t.status !== f.status) return false;
    if (f.assigneeId && t.assignee_id !== f.assigneeId) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.tagId && !(t.tags ?? []).some((tag) => tag.id === f.tagId)) return false;
    if (f.due) {
      // „Restante"/„Scadente" ignoră sarcinile finalizate sau fără termen.
      if (!t.due_date || t.status === "done") return false;
      const due = parseISO(t.due_date);
      if (f.due === "overdue" && !(due < startOfToday)) return false;
      if (f.due === "soon" && !(due >= startOfToday && due <= soonLimit)) return false;
    }
    return true;
  });
}

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
