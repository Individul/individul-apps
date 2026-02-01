"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import {
  TaskDetail,
  TaskStatus,
  TaskPriority,
  User,
  TaskActivity,
  fetchTask,
  fetchUsers,
  updateTask,
  deleteTask,
  addComment,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Save,
  MessageSquare,
  Clock,
  UserCircle,
  CheckCircle,
  AlertCircle,
  ArrowRightLeft,
  Send,
} from "lucide-react";

interface TaskDetailPageProps {
  params: { id: string };
}

export default function TaskDetailPage({ params }: TaskDetailPageProps) {
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comment, setComment] = useState("");
  const [commentUser, setCommentUser] = useState<string>("none");
  const [sendingComment, setSendingComment] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assignee, setAssignee] = useState<string>("none");

  useEffect(() => {
    loadTask();
    fetchUsers().then(setUsers).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function loadTask() {
    setLoading(true);
    try {
      const data = await fetchTask(params.id);
      setTask(data);
      // Populate form
      setTitle(data.title);
      setDescription(data.description || "");
      setStatus(data.status);
      setPriority(data.priority);
      setCategory(data.category || "");
      setTags(data.tags?.join(", ") || "");
      setDeadline(data.deadline || "");
      setAssignee(data.assignee?.toString() || "none");
    } catch (error) {
      console.error("Failed to load task:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    try {
      const tagsArray = tags
        ? tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0)
        : [];
      await updateTask(task.id, {
        title,
        description,
        status,
        priority,
        category,
        tags: tagsArray,
        deadline: deadline || null,
        assignee: assignee !== "none" ? parseInt(assignee) : null,
      });
      await loadTask();
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task || !confirm("Ești sigur că vrei să ștergi această sarcină?")) return;
    setDeleting(true);
    try {
      await deleteTask(task.id);
      router.push("/");
    } catch (error) {
      console.error("Failed to delete task:", error);
      setDeleting(false);
    }
  }

  async function handleAddComment() {
    if (!task || !comment.trim()) return;
    setSendingComment(true);
    try {
      await addComment(
        task.id,
        comment,
        commentUser !== "none" ? parseInt(commentUser) : undefined
      );
      setComment("");
      await loadTask();
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setSendingComment(false);
    }
  }

  function getActivityIcon(action: string) {
    switch (action) {
      case "CREATED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "STATUS_CHANGED":
        return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
      case "PRIORITY_CHANGED":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "ASSIGNED":
      case "UNASSIGNED":
        return <UserCircle className="h-4 w-4 text-purple-500" />;
      case "COMMENT":
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  }

  function formatActivityDetails(activity: TaskActivity) {
    const { action, details, user_details } = activity;
    const userName = user_details?.full_name || "Sistem";

    switch (action) {
      case "CREATED":
        return `${userName} a creat sarcina`;
      case "STATUS_CHANGED":
        return `${userName} a schimbat statusul din "${getStatusLabel(details.old_status as string)}" în "${getStatusLabel(details.new_status as string)}"`;
      case "PRIORITY_CHANGED":
        return `${userName} a schimbat prioritatea din "${getPriorityLabel(details.old_priority as string)}" în "${getPriorityLabel(details.new_priority as string)}"`;
      case "ASSIGNED":
        return `${userName} a atribuit sarcina către ${details.assignee_name}`;
      case "UNASSIGNED":
        return `${userName} a dezatribuit sarcina`;
      case "COMMENT":
        return details.comment as string;
      default:
        return activity.action_display;
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "TODO": return "De făcut";
      case "IN_PROGRESS": return "În progres";
      case "DONE": return "Finalizat";
      default: return status;
    }
  }

  function getPriorityLabel(priority: string) {
    switch (priority) {
      case "HIGH": return "Ridicată";
      case "MEDIUM": return "Medie";
      case "LOW": return "Scăzută";
      default: return priority;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Sarcina nu a fost găsită</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la listă
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Înapoi
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvează
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left - Task Form */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Titlu</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titlul sarcinii"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descriere</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrierea sarcinii"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">De făcut</SelectItem>
                    <SelectItem value="IN_PROGRESS">În progres</SelectItem>
                    <SelectItem value="DONE">Finalizat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioritate</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
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
              <Label>Responsabil</Label>
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
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="ex: Muncă, Personal, Cumpărături"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Etichete</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="ex: urgent, frontend, bug (separate prin virgulă)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Termen limită</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Right - Timeline */}
        <div className="w-96 border-l bg-muted/30 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Activitate</h2>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {task.activities && task.activities.length > 0 ? (
                task.activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="mt-1">{getActivityIcon(activity.action)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${activity.action === "COMMENT" ? "" : "text-muted-foreground"}`}>
                        {activity.action === "COMMENT" && activity.user_details && (
                          <span className="font-medium text-foreground">
                            {activity.user_details.full_name}:{" "}
                          </span>
                        )}
                        {formatActivityDetails(activity)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.created_at).toLocaleString("ro-RO")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nu există activitate încă
                </p>
              )}
            </div>
          </div>

          {/* Comment Input */}
          <div className="p-4 border-t space-y-3">
            <Select value={commentUser} onValueChange={setCommentUser}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Comentează ca..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Anonim</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder="Adaugă un comentariu..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              />
              <Button size="icon" onClick={handleAddComment} disabled={sendingComment || !comment.trim()}>
                {sendingComment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
