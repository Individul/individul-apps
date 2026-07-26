"use client";

import { cn } from "@/lib/utils";
import { filterTasks, type TaskFilter } from "@/lib/task-filters";
import type { Task } from "@/lib/types";

interface View {
  key: string;
  label: string;
  filter: TaskFilter;
  danger?: boolean;
}

function sameFilter(a: TaskFilter, b: TaskFilter): boolean {
  return (
    a.status === b.status &&
    a.assigneeId === b.assigneeId &&
    a.priority === b.priority &&
    a.due === b.due
  );
}

interface QuickViewsProps {
  tasks: Task[];
  currentUserId: string | null;
  filter: TaskFilter;
  onFilterChange: (f: TaskFilter) => void;
}

export function QuickViews({ tasks, currentUserId, filter, onFilterChange }: QuickViewsProps) {
  const views: View[] = [
    { key: "all", label: "Toate", filter: {} },
    ...(currentUserId
      ? [{ key: "mine", label: "Ale mele", filter: { assigneeId: currentUserId } as TaskFilter }]
      : []),
    { key: "overdue", label: "Restante", filter: { due: "overdue" }, danger: true },
    { key: "soon", label: "Scadente 7 zile", filter: { due: "soon" } },
    { key: "todo", label: "De făcut", filter: { status: "todo" } },
    { key: "in_progress", label: "În lucru", filter: { status: "in_progress" } },
    { key: "done", label: "Finalizat", filter: { status: "done" } },
  ];

  return (
    <nav className="space-y-1">
      <h2 className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Vederi
      </h2>
      {views.map((v) => {
        const count = filterTasks(tasks, v.filter).length;
        const active = sameFilter(filter, v.filter);
        const danger = v.danger && count > 0;
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => onFilterChange(v.filter)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <span className={cn(danger && "text-red-600")}>{v.label}</span>
            <span
              className={cn(
                "tabular-nums text-xs",
                danger ? "text-red-600" : "text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
