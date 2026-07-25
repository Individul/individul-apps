"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Column, ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PRIORITY_ORDER } from "@/lib/task-filters";
import type { Task, TaskStatus, TaskPriority } from "@/lib/types";

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

function SortableHeader({ column, label }: { column: Column<Task, unknown>; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

export interface ColumnHandlers {
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function makeColumns({ onEdit, onDelete }: ColumnHandlers): ColumnDef<Task>[] {
  return [
  {
    accessorKey: "title",
    header: "Titlu",
    cell: ({ row }) => (
      <Link
        href={`/tasks/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.title}
      </Link>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} label="Stare" />,
    cell: ({ row }) => {
      const meta = STATUS_META[row.original.status];
      return <Badge className={meta.className}>{meta.label}</Badge>;
    },
  },
  {
    id: "priority",
    accessorFn: (task) => PRIORITY_ORDER[task.priority],
    header: ({ column }) => <SortableHeader column={column} label="Prioritate" />,
    cell: ({ row }) => {
      const meta = PRIORITY_META[row.original.priority];
      return <Badge className={meta.className}>{meta.label}</Badge>;
    },
  },
  {
    accessorKey: "assignee",
    header: "Responsabil",
    enableSorting: false,
    cell: ({ row }) => {
      const assignee = row.original.assignee;
      if (!assignee) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">{initials(assignee.full_name)}</AvatarFallback>
          </Avatar>
          <span>{assignee.full_name ?? "—"}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "due_date",
    header: ({ column }) => <SortableHeader column={column} label="Termen" />,
    cell: ({ row }) => {
      if (!row.original.due_date) return <span className="text-muted-foreground">—</span>;
      const due = parseISO(row.original.due_date);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const overdue = due < startOfToday && row.original.status !== "done";
      return (
        <span className={cn(overdue && "text-red-600")}>{format(due, "d MMM yyyy")}</span>
      );
    },
  },
  {
    accessorKey: "tags",
    header: "Etichete",
    enableSorting: false,
    cell: ({ row }) => {
      const tags = row.original.tags ?? [];
      if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              className="border-transparent text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => {
      const task = row.original;
      return (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Acțiuni</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(task)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editează
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(task)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Șterge
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
  ];
}
