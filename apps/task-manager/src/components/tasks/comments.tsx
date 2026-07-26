"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { addComment, deleteComment, editComment } from "@/app/tasks/actions";
import { canDeleteComment, canEditComment } from "@/lib/permissions";
import type { Comment } from "@/lib/types";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ro });
}

interface CommentsProps {
  taskId: string;
  comments: Comment[];
  currentUserId: string | null;
  isAdmin: boolean;
}

export function Comments({ taskId, comments, currentUserId, isAdmin }: CommentsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const handleAdd = () => {
    const body = newBody.trim();
    if (!body) {
      toast.error("Comentariul nu poate fi gol.");
      return;
    }
    startTransition(async () => {
      const res = await addComment(taskId, body);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setNewBody("");
      router.refresh();
    });
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody("");
  };

  const handleEdit = (commentId: string) => {
    const body = editBody.trim();
    if (!body) {
      toast.error("Comentariul nu poate fi gol.");
      return;
    }
    startTransition(async () => {
      const res = await editComment(commentId, taskId, body);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      cancelEdit();
      router.refresh();
    });
  };

  const handleDelete = (commentId: string) => {
    if (!window.confirm("Ștergi comentariul?")) return;
    startTransition(async () => {
      const res = await deleteComment(commentId, taskId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Comentarii ({comments.length})
      </h2>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Niciun comentariu încă.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => {
            const canEdit = canEditComment(currentUserId ?? "", comment);
            const canDelete = canDeleteComment(currentUserId ?? "", isAdmin, comment);
            const isEditing = editingId === comment.id;
            return (
              <li key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {initials(comment.author?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      {comment.author?.full_name ?? "Utilizator"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(comment.created_at)}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        disabled={isPending}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleEdit(comment.id)}
                          disabled={isPending}
                        >
                          Salvează
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={isPending}
                        >
                          Anulează
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                      {(canEdit || canDelete) && (
                        <div className="flex gap-3 text-xs">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => startEdit(comment)}
                              disabled={isPending}
                              className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                            >
                              Editează
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(comment.id)}
                              disabled={isPending}
                              className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                            >
                              Șterge
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2">
        <Textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Scrie un comentariu…"
          disabled={isPending}
        />
        <Button onClick={handleAdd} disabled={isPending}>
          Adaugă comentariu
        </Button>
      </div>
    </section>
  );
}
