import {
  getTasks,
  getProfiles,
  getTags,
  getCurrentProfile,
  getNotifications,
  getUnreadCount,
} from "@/lib/queries";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { AppHeader } from "@/components/layout/app-header";

export const dynamic = "force-dynamic";

export default async function SarciniPage() {
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
    <>
      <AppHeader
        profile={currentProfile}
        notifications={notifications}
        unread={unread}
      />
      <main className="mx-auto max-w-[1800px] p-4 xl:px-10">
        <h1 className="mb-4 text-2xl font-semibold">Sarcini</h1>
        <TasksWorkspace
          tasks={tasks}
          profiles={profiles}
          allTags={allTags}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      </main>
    </>
  );
}
