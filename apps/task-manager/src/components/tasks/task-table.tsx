"use client";

import { useMemo, useState, useTransition } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { makeColumns } from "@/components/tasks/columns";
import { TaskFiltersBar } from "@/components/tasks/task-filters-bar";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { deleteTask, finalizeTask } from "@/app/tasks/actions";
import { filterTasks, type TaskFilter } from "@/lib/task-filters";
import type { Profile, Tag, Task } from "@/lib/types";

interface TaskTableProps {
  tasks: Task[];
  profiles: Profile[];
  allTags: Tag[];
  currentUserId: string | null;
  isAdmin: boolean;
  filter: TaskFilter;
  onFilterChange: (f: TaskFilter) => void;
}

export function TaskTable({
  tasks,
  profiles,
  allTags,
  currentUserId,
  isAdmin,
  filter,
  onFilterChange,
}: TaskTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [, startTransition] = useTransition();

  const data = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

  const handleDelete = (task: Task) => {
    if (!window.confirm("Ștergi această sarcină?")) return;
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarcină ștearsă");
    });
  };

  const handleFinalize = (task: Task) => {
    startTransition(async () => {
      const result = await finalizeTask(task.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarcină finalizată");
    });
  };

  const columns = useMemo(
    () =>
      makeColumns({
        onEdit: (task) => {
          setEditingTask(task);
          setFormOpen(true);
        },
        onDelete: handleDelete,
        onFinalize: handleFinalize,
        currentUserId,
        isAdmin,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, isAdmin],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div>
      <TaskFiltersBar
        profiles={profiles}
        currentUserId={currentUserId}
        filter={filter}
        onFilterChange={onFilterChange}
        onNewTask={() => {
          setEditingTask(undefined);
          setFormOpen(true);
        }}
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">
                  Nicio sarcină.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TaskFormDialog
        profiles={profiles}
        allTags={allTags}
        task={editingTask}
        open={formOpen}
        onOpenChange={setFormOpen}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </div>
  );
}
