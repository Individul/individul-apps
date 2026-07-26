"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { attachTag, createTag, detachTag } from "@/app/tasks/actions";
import type { Tag } from "@/lib/types";

const DEFAULT_COLOR = "#64748b";

interface TagPickerProps {
  taskId: string;
  taskTags: Tag[];
  allTags: Tag[];
  isAdmin: boolean;
}

export function TagPicker({ taskId, taskTags, allTags, isAdmin }: TagPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);

  const attachedIds = new Set(taskTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !attachedIds.has(t.id));

  const handleAttach = (tagId: string) => {
    startTransition(async () => {
      const res = await attachTag(taskId, tagId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  };

  const handleDetach = (tagId: string) => {
    startTransition(async () => {
      const res = await detachTag(taskId, tagId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Numele etichetei e obligatoriu.");
      return;
    }
    startTransition(async () => {
      const created = await createTag(name, newColor);
      if (created.error || !created.tag) {
        toast.error(created.error ?? "Eroare la crearea etichetei.");
        return;
      }
      const attached = await attachTag(taskId, created.tag.id);
      if (attached.error) {
        toast.error(attached.error);
        return;
      }
      setNewName("");
      setNewColor(DEFAULT_COLOR);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {taskTags.length === 0 && (
          <span className="text-sm text-muted-foreground">Fără etichete</span>
        )}
        {taskTags.map((tag) => (
          <Badge
            key={tag.id}
            className="gap-1 border-transparent pr-1 text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              type="button"
              aria-label={`Elimină ${tag.name}`}
              onClick={() => handleDetach(tag.id)}
              disabled={isPending}
              className="rounded-full p-0.5 transition-colors hover:bg-black/20 disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7" disabled={isPending}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adaugă etichetă
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {availableTags.length === 0 ? (
              <DropdownMenuItem disabled>Nicio etichetă disponibilă</DropdownMenuItem>
            ) : (
              availableTags.map((tag) => (
                <DropdownMenuItem key={tag.id} onSelect={() => handleAttach(tag.id)}>
                  <span
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Etichetă nouă"
            className="h-8 w-40"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            aria-label="Culoare etichetă"
            className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-1"
          />
          <Button size="sm" className="h-8" onClick={handleCreate} disabled={isPending}>
            Creează
          </Button>
        </div>
      )}
    </div>
  );
}
