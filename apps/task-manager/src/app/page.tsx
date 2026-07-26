import Link from "next/link";
import {
  getTasks,
  getProfiles,
  getTags,
  getCurrentProfile,
  getNotifications,
  getUnreadCount,
} from "@/lib/queries";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { ProfileDialog } from "@/components/account/profile-dialog";
import { ChangePasswordDialog } from "@/components/account/change-password-dialog";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tasks, profiles, allTags, currentProfile, notifications, unread] =
    await Promise.all([
      getTasks(),
      getProfiles(),
      getTags(),
      getCurrentProfile(),
      getNotifications(),
      getUnreadCount(),
    ]);
  const currentUserId = currentProfile?.id ?? null;
  const isAdmin = currentProfile?.role === "admin";

  return (
    <main className="mx-auto max-w-[1800px] p-6 xl:px-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sarcini</h1>
        <div className="flex items-center gap-2">
          {currentUserId && (
            <NotificationBell
              initialItems={notifications}
              initialUnread={unread}
              userId={currentUserId}
            />
          )}
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm">
                Administrare
              </Button>
            </Link>
          )}
          <ProfileDialog
            currentFullName={currentProfile?.full_name ?? ""}
            currentUsername={currentProfile?.username ?? ""}
          />
          <ChangePasswordDialog />
          <form action="/auth/signout" method="post">
            <Button variant="outline" size="sm" type="submit">
              Deconectare
            </Button>
          </form>
        </div>
      </div>
      <TasksWorkspace
        tasks={tasks}
        profiles={profiles}
        allTags={allTags}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </main>
  );
}
