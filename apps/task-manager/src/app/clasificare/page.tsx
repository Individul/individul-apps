import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { ClassifyTool } from "@/components/penal/classify-tool";
import { getCurrentProfile, getNotifications, getUnreadCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Clasificarea infracțiunii, ca pagină — pereche cu /termen.
 *
 * Aici lista de articole poate crește fără să împingă răspunsul afară din
 * ecran, cum se întâmpla în fereastră.
 */
export default async function ClasificarePage() {
  const [profile, notifications, unread] = await Promise.all([
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
  ]);

  return (
    <>
      <AppHeader profile={profile} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-5xl p-4 xl:px-10">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Clasificarea infracțiunii</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Acasă
          </Link>
        </div>
        <ClassifyTool />
      </main>
    </>
  );
}
