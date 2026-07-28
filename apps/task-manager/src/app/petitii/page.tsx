import {
  getPetitions,
  getProfiles,
  getCurrentProfile,
  getNotifications,
  getUnreadCount,
} from "@/lib/queries";
import { PetitionsWorkspace } from "@/components/petitions/petitions-workspace";
import { AppHeader } from "@/components/layout/app-header";

export const dynamic = "force-dynamic";

export default async function PetitiiPage() {
  const [petitions, profiles, currentProfile, notifications, unread] =
    await Promise.all([
      getPetitions(),
      getProfiles(),
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
        <h1 className="mb-4 text-2xl font-semibold">Petiții</h1>
        <PetitionsWorkspace
          petitions={petitions}
          profiles={profiles}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      </main>
    </>
  );
}
