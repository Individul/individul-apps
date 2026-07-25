import { getTasks, getProfiles, getCurrentUserId } from "@/lib/queries";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, profiles, currentUserId] = await Promise.all([
    getTasks(),
    getProfiles(),
    getCurrentUserId(),
  ]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Task-uri</h1>
        <form action="/auth/signout" method="post">
          <Button variant="outline" size="sm" type="submit">
            Deconectare
          </Button>
        </form>
      </div>
      <TaskTable tasks={tasks} profiles={profiles} currentUserId={currentUserId} />
    </main>
  );
}
