import Link from "next/link";
import { getPetitions, getProfiles, getCurrentProfile } from "@/lib/queries";
import { PetitionsList } from "@/components/petitions/petitions-list";
import { ProfileDialog } from "@/components/account/profile-dialog";
import { ChangePasswordDialog } from "@/components/account/change-password-dialog";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PetitiiPage() {
  const [petitions, profiles, currentProfile] = await Promise.all([
    getPetitions(),
    getProfiles(),
    getCurrentProfile(),
  ]);
  const currentUserId = currentProfile?.id ?? null;
  const isAdmin = currentProfile?.role === "admin";

  return (
    <main className="mx-auto max-w-[1800px] p-6 xl:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Petiții</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Sarcini
          </Link>
        </div>
        <div className="flex items-center gap-2">
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
      <PetitionsList
        petitions={petitions}
        profiles={profiles}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </main>
  );
}
