import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { CumulTool } from "@/components/penal/cumul-tool";
import { getCurrentProfile, getNotifications, getUnreadCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Art. 84 alin. (4) sau art. 85 — care se aplică la a doua sentință.
 *
 * Pagină proprie, nu o a treia secțiune la /termen: acolo se socotește un termen
 * pe o pedeapsă deja stabilită, aici se răspunde la o întrebare de dinaintea
 * pedepsei. Ce au în comun sunt datele, nu socoteala.
 */
export default async function CumulPage() {
  const [profile, notifications, unread] = await Promise.all([
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
  ]);

  return (
    <>
      <AppHeader profile={profile} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-5xl p-4 xl:px-10">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Concurs de infracțiuni sau cumul de sentințe</h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Acasă
          </Link>
        </div>
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          Când un condamnat primește încă o sentință, temeiul e art. 84 alin. (4) sau
          art. 85. Le desparte o singură întrebare: era omul deja condamnat când a
          săvârșit fapta? Deci data săvârșirii față de data pronunțării primei sentințe —
          „sentinţa în prima cauză”, cum îi zice art. 84 alin. (4). Sentințele pot fi
          oricâte: se așază în ordinea pronunțării, iar temeiul se hotărăște pentru
          fiecare.
        </p>
        <CumulTool />
      </main>
    </>
  );
}
