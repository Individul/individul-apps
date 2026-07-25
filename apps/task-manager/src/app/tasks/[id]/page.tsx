import { notFound } from "next/navigation";
import Link from "next/link";
import { getTask, getProfiles, getTags, getCurrentUserId } from "@/lib/queries";
import { TaskDetail } from "@/components/tasks/task-detail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const [task, profiles, allTags, currentUserId] = await Promise.all([
    getTask(params.id),
    getProfiles(),
    getTags(),
    getCurrentUserId(),
  ]);
  if (!task) notFound();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/tasks">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi la task-uri
        </Button>
      </Link>
      <TaskDetail task={task} profiles={profiles} allTags={allTags} currentUserId={currentUserId} />
    </main>
  );
}
