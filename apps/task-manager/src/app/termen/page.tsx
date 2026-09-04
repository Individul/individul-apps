import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { TermTool } from "@/components/penal/term-tool";
import { getCurrentProfile, getNotifications, getUnreadCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Calculatorul de termen, ca pagină.
 *
 * A fost întâi fereastră, pe ideea că e o socoteală pe care o faci și o închizi.
 * Dar în lățimea unei ferestre cele două unelte nu încăpeau decât pe rând, deci
 * se comuta între ele — iar pagina le ține alături. Nu e în bara de module:
 * acolo stau registrele, care se completează; asta doar socotește.
 */
export default async function TermenPage() {
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
          <h1 className="text-2xl font-semibold">Calculator termen</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Acasă
          </Link>
        </div>
        <TermTool />
      </main>
    </>
  );
}
