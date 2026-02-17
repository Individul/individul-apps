"use client";

import { useState, useEffect } from "react";
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
import { Task, TaskUser, TaskCreate, tasksApi } from "@/lib/api";
import { Loader2, Trash2 } from "lucide-react";

type TaskStatus = Task["status"];
type TaskPriority = Task["priority"];

interface TaskFormProps {
  task?: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TaskForm({ task, open, onOpenChange, onSuccess }: TaskFormProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [assignee, setAssignee] = useState<string>("none");

  const isEditing = !!task;

  useEffect(() => {
    if (open) {
      const token = localStorage.getItem("access_token");
      if (token) {
        tasksApi.users(token).then(setUsers).catch(console.error);
      }
      setAssignee(task?.assignee?.toString() || "none");
    }
  }, [open, task]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const formData = new FormData(e.currentTarget);
    const tagsString = formData.get("tags") as string;
    const tags = tagsString
      ? tagsString.split(",").map(t => t.trim()).filter(t => t.length > 0)
      : [];
    const data: TaskCreate = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      status: formData.get("status") as TaskStatus,
      priority: formData.get("priority") as TaskPriority,
      category: formData.get("category") as string,
      tags,
      deadline: formData.get("deadline") as string || null,
      assignee: assignee && assignee !== "none" ? parseInt(assignee) : null,
    };

    try {
      if (isEditing) {
        await tasksApi.update(token, task.id, data);
      } else {
        await tasksApi.create(token, data);
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
    if (!task || !confirm("Esti sigur ca vrei sa stergi aceasta sarcina?")) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    setDeleting(true);
    try {
      await tasksApi.delete(token, task.id);
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
          <SheetTitle>{isEditing ? "Editeaza Sarcina" : "Sarcina Noua"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Actualizeaza detaliile sarcinii mai jos." : "Completeaza detaliile pentru noua sarcina."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="title">Titlu</Label>
            <Input
              id="title"
              name="title"
              defaultValue={task?.title || ""}
              placeholder="Titlul sarcinii"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descriere</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={task?.description || ""}
              placeholder="Descrierea sarcinii"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={task?.status || "TODO"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteaza status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">De facut</SelectItem>
                  <SelectItem value="IN_PROGRESS">In progres</SelectItem>
                  <SelectItem value="DONE">Finalizat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioritate</Label>
              <Select name="priority" defaultValue={task?.priority || "MEDIUM"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteaza prioritate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Scazuta</SelectItem>
                  <SelectItem value="MEDIUM">Medie</SelectItem>
                  <SelectItem value="HIGH">Ridicata</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Responsabil</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteaza responsabil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nealocat</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categorie</Label>
            <Select name="category" defaultValue={task?.category || ""}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteaza categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUMULARE">Cumulare</SelectItem>
                <SelectItem value="AREST_PREVENTIV">Arest preventiv</SelectItem>
                <SelectItem value="NECLARITATI">Neclaritati</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Etichete</Label>
            <Input
              id="tags"
              name="tags"
              defaultValue={task?.tags?.join(", ") || ""}
              placeholder="ex: urgent, frontend, bug (separate prin virgula)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Termen limita</Label>
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
              {isEditing ? "Actualizeaza" : "Creaza"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
