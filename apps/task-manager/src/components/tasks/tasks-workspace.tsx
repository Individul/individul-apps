"use client";

import { useState } from "react";

import { QuickViews } from "@/components/tasks/quick-views";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskSummary } from "@/components/tasks/task-summary";
import { AssigneeBreakdown } from "@/components/tasks/assignee-breakdown";
import { TagsPanel } from "@/components/tasks/tags-panel";
import type { TaskFilter } from "@/lib/task-filters";
import type { Profile, Tag, Task } from "@/lib/types";

interface TasksWorkspaceProps {
  tasks: Task[];
  profiles: Profile[];
  allTags: Tag[];
  currentUserId: string | null;
  isAdmin: boolean;
}

export function TasksWorkspace({
  tasks,
  profiles,
  allTags,
  currentUserId,
  isAdmin,
}: TasksWorkspaceProps) {
  const [filter, setFilter] = useState<TaskFilter>({});
  // Membrii văd rezumatul propriilor sarcini; adminul vede totalul + per utilizator.
  const summaryTasks = isAdmin ? tasks : tasks.filter((t) => t.assignee_id === currentUserId);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="lg:w-56 lg:shrink-0">
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
          allTags={allTags}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>

      <aside className="space-y-4 lg:w-80 lg:shrink-0">
        <TaskSummary tasks={summaryTasks} label={isAdmin ? "Rezumat" : "Rezumatul meu"} />
        {isAdmin && <AssigneeBreakdown tasks={tasks} profiles={profiles} />}
        <TagsPanel
          allTags={allTags}
          tasks={tasks}
          filter={filter}
          onFilterChange={setFilter}
          isAdmin={isAdmin}
        />
      </aside>
    </div>
  );
}
