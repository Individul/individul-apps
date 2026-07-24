"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TagPicker } from "@/components/tasks/tag-picker";
import { Comments } from "./comments";
import type { Comment, Profile, Tag, Task, TaskPriority, TaskStatus } from "@/lib/types";

const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "De făcut", className: "border-transparent bg-slate-100 text-slate-700" },
  in_progress: { label: "În lucru", className: "border-transparent bg-blue-100 text-blue-700" },
  done: { label: "Finalizat", className: "border-transparent bg-green-100 text-green-700" },
};

const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Scăzută", className: "border-transparent bg-slate-100 text-slate-700" },
  medium: { label: "Medie", className: "border-transparent bg-amber-100 text-amber-800" },
  high: { label: "Ridicată", className: "border-transparent bg-red-100 text-red-700" },
};

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

interface TaskDetailProps {
  task: Task & { comments: Comment[] };
  profiles: Profile[];
  allTags: Tag[];
  currentUserId: string | null;
}

export function TaskDetail({ task, profiles, allTags, currentUserId }: TaskDetailProps) {
  const [editOpen, setEditOpen] = useState(false);

  const status = STATUS_META[task.status];
  const priority = PRIORITY_META[task.priority];
  const assignee = task.assignee;

  return (
    <article className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={status.className}>{status.label}</Badge>
            <Badge className={priority.className}>{priority.label}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" /> Editează
        </Button>
      </header>

      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
        <div className="space-y-1">
          <dt className="text-muted-foreground">Responsabil</dt>
          <dd>
            {assignee ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials(assignee.full_name)}</AvatarFallback>
                </Avatar>
                <span>{assignee.full_name ?? "(fără nume)"}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Neatribuit</span>
            )}
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="text-muted-foreground">Termen</dt>
          <dd>
            {task.due_date ? (
              format(parseISO(task.due_date), "d MMM yyyy")
            ) : (
              <span className="text-muted-foreground">Fără termen</span>
            )}
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="text-muted-foreground">Creat</dt>
          <dd>{format(parseISO(task.created_at), "d MMM yyyy")}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Descriere</h2>
        {task.description ? (
          <p className="whitespace-pre-wrap text-sm">{task.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Fără descriere</p>
        )}
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Etichete</h2>
        <TagPicker taskId={task.id} taskTags={task.tags ?? []} allTags={allTags} />
      </section>

      <Separator />

      <Comments taskId={task.id} comments={task.comments} currentUserId={currentUserId} />

      <TaskFormDialog
        profiles={profiles}
        task={task}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </article>
  );
}
