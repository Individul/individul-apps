import type { Task, TaskStatus, TaskPriority } from "./types";

export const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export interface TaskFilter {
  status?: TaskStatus;
  assigneeId?: string;
  priority?: TaskPriority;
}

export function filterTasks(tasks: Task[], f: TaskFilter): Task[] {
  return tasks.filter(
    (t) =>
      (f.status ? t.status === f.status : true) &&
      (f.assigneeId ? t.assignee_id === f.assigneeId : true) &&
      (f.priority ? t.priority === f.priority : true),
  );
}

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
