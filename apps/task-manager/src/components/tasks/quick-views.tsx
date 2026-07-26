"use client";

import { cn } from "@/lib/utils";
import { filterTasks, type TaskFilter } from "@/lib/task-filters";
import type { Task } from "@/lib/types";

interface View {
  key: string;
  label: string;
  filter: TaskFilter;
  dot: string;
  danger?: boolean;
}

function sameFilter(a: TaskFilter, b: TaskFilter): boolean {
  return (
    a.status === b.status &&
    a.assigneeId === b.assigneeId &&
    a.priority === b.priority &&
    a.due === b.due &&
    a.tagId === b.tagId
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
    { key: "all", label: "Toate", filter: {}, dot: "bg-slate-300" },
    ...(currentUserId
      ? [
          {
            key: "mine",
            label: "Ale mele",
            filter: { assigneeId: currentUserId } as TaskFilter,
            dot: "bg-slate-500",
          },
        ]
      : []),
    { key: "overdue", label: "Restante", filter: { due: "overdue" }, dot: "bg-red-400", danger: true },
    { key: "soon", label: "Scadente 7 zile", filter: { due: "soon" }, dot: "bg-amber-400" },
    { key: "todo", label: "De făcut", filter: { status: "todo" }, dot: "bg-slate-400" },
    { key: "in_progress", label: "În lucru", filter: { status: "in_progress" }, dot: "bg-sky-500" },
    { key: "done", label: "Finalizat", filter: { status: "done" }, dot: "bg-emerald-500" },
  ];

  return (
    <nav className="space-y-0.5">
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
            onClick={() => onFilterChange({ ...v.filter, search: filter.search })}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-foreground"
                : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", v.dot)} aria-hidden />
            <span className="flex-1 text-left">{v.label}</span>
            <span
              className={cn(
                "min-w-[1.5rem] rounded px-1.5 py-0.5 text-center text-xs tabular-nums",
                danger ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground",
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
