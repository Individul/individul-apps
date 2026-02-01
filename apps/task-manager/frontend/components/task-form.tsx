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
import { Task, TaskStatus, TaskPriority, User, createTask, updateTask, deleteTask, fetchUsers } from "@/lib/api";
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
  const [users, setUsers] = useState<User[]>([]);
  const [assignee, setAssignee] = useState<string>("none");

  const isEditing = !!task;

  useEffect(() => {
    if (open) {
      fetchUsers().then(setUsers).catch(console.error);
      setAssignee(task?.assignee?.toString() || "none");
    }
  }, [open, task]);

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
      assignee: assignee && assignee !== "none" ? parseInt(assignee) : null,
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
    if (!task || !confirm("Ești sigur că vrei să ștergi această sarcină?")) return;

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
          <SheetTitle>{isEditing ? "Editează Sarcina" : "Sarcină Nouă"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Actualizează detaliile sarcinii mai jos." : "Completează detaliile pentru noua sarcină."}
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
                  <SelectValue placeholder="Selectează status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">De făcut</SelectItem>
                  <SelectItem value="IN_PROGRESS">În progres</SelectItem>
                  <SelectItem value="DONE">Finalizat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioritate</Label>
              <Select name="priority" defaultValue={task?.priority || "MEDIUM"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează prioritate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Scăzută</SelectItem>
                  <SelectItem value="MEDIUM">Medie</SelectItem>
                  <SelectItem value="HIGH">Ridicată</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Responsabil</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează responsabil" />
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
                <SelectValue placeholder="Selectează categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUMULARE">Cumulare</SelectItem>
                <SelectItem value="AREST_PREVENTIV">Arest preventiv</SelectItem>
                <SelectItem value="NECLARITATI">Neclarități</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Etichete</Label>
            <Input
              id="tags"
              name="tags"
              defaultValue={task?.tags?.join(", ") || ""}
              placeholder="ex: urgent, frontend, bug (separate prin virgulă)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Termen limită</Label>
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
              {isEditing ? "Actualizează" : "Crează"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
