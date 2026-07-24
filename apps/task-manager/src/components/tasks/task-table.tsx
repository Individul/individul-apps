"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { columns } from "@/components/tasks/columns";
import { TaskFiltersBar } from "@/components/tasks/task-filters-bar";
import { filterTasks, type TaskFilter } from "@/lib/task-filters";
import type { Profile, Task } from "@/lib/types";

interface TaskTableProps {
  tasks: Task[];
  profiles: Profile[];
  currentUserId: string | null;
}

export function TaskTable({ tasks, profiles, currentUserId }: TaskTableProps) {
  const [filter, setFilter] = useState<TaskFilter>({});
  const [sorting, setSorting] = useState<SortingState>([]);

  const data = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

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
        onFilterChange={setFilter}
      />
      <div className="rounded-md border">
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Niciun task.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
