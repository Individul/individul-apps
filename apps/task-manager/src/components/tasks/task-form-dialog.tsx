"use client";

import { useEffect, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTask, updateTask } from "@/app/tasks/actions";
import { canReassignTask } from "@/lib/permissions";
import { taskSchema, type TaskInput } from "@/lib/schemas";
import type { Profile, Task, TaskPriority, TaskStatus } from "@/lib/types";

const UNASSIGNED = "unassigned";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "De făcut" },
  { value: "in_progress", label: "În lucru" },
  { value: "done", label: "Finalizat" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Scăzută" },
  { value: "medium", label: "Medie" },
  { value: "high", label: "Ridicată" },
];

interface TaskFormDialogProps {
  profiles: Profile[];
  task?: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  currentUserId: string | null;
}

function defaultValues(task: Task | undefined, canReassign: boolean, currentUserId: string | null): TaskInput {
  let assignee_id: string;
  if (task) {
    // On edit, preserve the existing assignee regardless of role.
    assignee_id = task.assignee_id ?? "";
  } else if (!canReassign) {
    // Members creating a task are auto-assigned to themselves.
    assignee_id = currentUserId ?? "";
  } else {
    assignee_id = "";
  }
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? "medium",
    due_date: task?.due_date ?? "",
    assignee_id,
  };
}

export function TaskFormDialog({
  profiles,
  task,
  open,
  onOpenChange,
  isAdmin,
  currentUserId,
}: TaskFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(task);
  const canReassign = canReassignTask(isAdmin);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: defaultValues(task, canReassign, currentUserId),
  });

  useEffect(() => {
    if (open) reset(defaultValues(task, canReassign, currentUserId));
  }, [open, task, canReassign, currentUserId, reset]);

  const onSubmit = (values: TaskInput) => {
    startTransition(async () => {
      const result = task ? await updateTask(task.id, values) : await createTask(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarcină salvată");
      if (!task) reset(defaultValues(undefined, canReassign, currentUserId));
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editează sarcina" : "Sarcină nouă"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Titlu</Label>
            <Input id="title" placeholder="Titlul sarcinii" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descriere</Label>
            <Textarea
              id="description"
              placeholder="Detalii (opțional)"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Stare</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Prioritate</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="due_date">Termen</Label>
              <Input id="due_date" type="date" {...register("due_date")} />
            </div>

            <div className="space-y-2">
              <Label>Responsabil</Label>
              <Controller
                control={control}
                name="assignee_id"
                render={({ field }) => (
                  <Select
                    value={field.value ? field.value : UNASSIGNED}
                    onValueChange={(v) => field.onChange(v === UNASSIGNED ? "" : v)}
                    disabled={!canReassign}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Neatribuit</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name ?? "(fără nume)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Anulează
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Salvează" : "Creează"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
