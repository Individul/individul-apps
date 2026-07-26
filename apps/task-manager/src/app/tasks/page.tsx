import Link from "next/link";
import { getTasks, getProfiles, getCurrentProfile } from "@/lib/queries";
import { TaskTable } from "@/components/tasks/task-table";
import { ProfileDialog } from "@/components/account/profile-dialog";
import { ChangePasswordDialog } from "@/components/account/change-password-dialog";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, profiles, currentProfile] = await Promise.all([
    getTasks(),
    getProfiles(),
    getCurrentProfile(),
  ]);
  const currentUserId = currentProfile?.id ?? null;
  const isAdmin = currentProfile?.role === "admin";

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Task-uri</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm">
                Administrare
              </Button>
            </Link>
          )}
          <ProfileDialog currentFullName={currentProfile?.full_name ?? ""} />
          <ChangePasswordDialog />
          <form action="/auth/signout" method="post">
            <Button variant="outline" size="sm" type="submit">
              Deconectare
            </Button>
          </form>
        </div>
      </div>
      <TaskTable
        tasks={tasks}
        profiles={profiles}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </main>
  );
}
