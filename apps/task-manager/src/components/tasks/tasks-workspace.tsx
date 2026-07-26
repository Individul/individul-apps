"use client";

import { useState } from "react";

import { QuickViews } from "@/components/tasks/quick-views";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskSummary } from "@/components/tasks/task-summary";
import { AssigneeBreakdown } from "@/components/tasks/assignee-breakdown";
import type { TaskFilter } from "@/lib/task-filters";
import type { Profile, Task } from "@/lib/types";

interface TasksWorkspaceProps {
  tasks: Task[];
  profiles: Profile[];
  currentUserId: string | null;
  isAdmin: boolean;
}

export function TasksWorkspace({ tasks, profiles, currentUserId, isAdmin }: TasksWorkspaceProps) {
  const [filter, setFilter] = useState<TaskFilter>({});

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="lg:w-52 lg:shrink-0">
        <QuickViews
          tasks={tasks}
          currentUserId={currentUserId}
          filter={filter}
          onFilterChange={setFilter}
        />
      </aside>

      <div className="min-w-0 flex-1">
        <TaskTable
          tasks={tasks}
          profiles={profiles}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>

      <aside className="space-y-4 lg:w-72 lg:shrink-0">
        <TaskSummary tasks={tasks} />
        <AssigneeBreakdown tasks={tasks} profiles={profiles} />
      </aside>
    </div>
  );
}
