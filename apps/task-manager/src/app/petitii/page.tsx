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

export default async function PetitiiPage({
  searchParams,
}: {
  // `string[]`, nu `string`, când parametrul apare de mai multe ori în adresă —
  // așa îl dă Next. Se ia prima valoare, ca la raportul săptămânal.
  searchParams: { petitie?: string | string[] };
}) {
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
          openPetitionId={
            Array.isArray(searchParams.petitie)
              ? searchParams.petitie[0]
              : searchParams.petitie
          }
        />
      </main>
    </>
  );
}
