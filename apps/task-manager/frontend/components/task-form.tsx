"use client";

import { useState } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import { Task, TaskStatus, TaskPriority, createTask, updateTask, deleteTask } from "@/lib/api";
import { Loader2, Trash2 } from "lucide-react";

interface TaskFormProps {
  task?: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TaskForm({ task, open, onOpenChange, onSuccess }: TaskFormProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!task;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const tagsString = formData.get("tags") as string;
    const tags = tagsString
      ? tagsString.split(",").map(t => t.trim()).filter(t => t.length > 0)
      : [];
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      status: formData.get("status") as TaskStatus,
      priority: formData.get("priority") as TaskPriority,
      category: formData.get("category") as string,
      tags,
      deadline: formData.get("deadline") as string || null,
    };

    try {
      if (isEditing) {
        await updateTask(task.id, data);
      } else {
        await createTask(data);
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!task || !confirm("Are you sure you want to delete this task?")) return;

    setDeleting(true);
    try {
      await deleteTask(task.id);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete task:", error);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Task" : "New Task"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update the task details below." : "Fill in the details for your new task."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={task?.title || ""}
              placeholder="Task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={task?.description || ""}
              placeholder="Task description"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={task?.status || "TODO"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">To Do</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue={task?.priority || "MEDIUM"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              defaultValue={task?.category || ""}
              placeholder="e.g., Work, Personal, Shopping"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              name="tags"
              defaultValue={task?.tags?.join(", ") || ""}
              placeholder="e.g., urgent, frontend, bug (comma separated)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              name="deadline"
              type="date"
              defaultValue={task?.deadline || ""}
            />
          </div>

          <SheetFooter className="flex gap-2 pt-4">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
