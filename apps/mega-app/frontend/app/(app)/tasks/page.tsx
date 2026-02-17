'use client'

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TaskList } from "@/components/tasks/task-list";
import { Skeleton } from "@/components/ui/skeleton";

function TasksContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || undefined;

  return (
    <main className="flex-1">
      <TaskList initialStatus={initialStatus} />
    </main>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    }>
      <TasksContent />
    </Suspense>
  );
}
