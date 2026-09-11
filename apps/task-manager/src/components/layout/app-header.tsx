import Link from "next/link";
import { ModuleTabs } from "@/components/layout/module-tabs";
import { ToolsMenu } from "@/components/layout/tools-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import type { Notification, Profile } from "@/lib/types";

interface AppHeaderProps {
  profile: Profile | null;
  notifications: Notification[];
  unread: number;
}

/**
 * `no-print`: bara nu ajunge niciodată pe hârtie.
 *
 * Cât timp fiecare pagină își desena singură antetul, raportul de marți îl
 * învelea el într-un `no-print` — grija stătea în pagina care tipărește. Mutat
 * în layout, antetul a ieșit din învelișul acela și a început să se tipărească;
 * iar la raportul de ședințe, care nu avusese niciodată antet, a apărut de tot.
 *
 * Aici e locul potrivit pentru regulă: bara e cadrul aplicației, nu conținut,
 * deci n-are ce căuta în niciun act tipărit. Aşezată o dată aici, nicio pagină
 * nouă nu mai trebuie să-şi aducă aminte de ea.
 */
export function AppHeader({ profile, notifications, unread }: AppHeaderProps) {
  const isAdmin = profile?.role === "admin";
  return (
    <header className="no-print border-b bg-card">
      <div className="mx-auto flex max-w-[1536px] flex-wrap items-center gap-3 p-4 xl:px-10">
        <Link href="/" className="text-sm font-medium">
          Acasă
        </Link>
        <ModuleTabs />
        {/* Despărțit de tab-uri prin golul de 3 al barei, nu printr-o linie:
            înăuntrul tab-urilor golul e de 1, deci ochiul vede singur că
            „Unelte" nu e al optulea registru. */}
        <ToolsMenu />
        {/* Se pliază și el, din același motiv ca filele de module.
            Butoanele fac laolaltă mai mult decât filele — deci plierea filelor
            singură lăsa antetul tot mai lat decât un telefon. „Unelte", venit
            între timp, mai adaugă din lățime pe același rând.
            `ml-auto` rămâne: pe un rând propriu, blocul se lipește la dreapta. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {profile && (
            <NotificationBell
              initialItems={notifications}
              initialUnread={unread}
              userId={profile.id}
            />
          )}
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm">
                Administrare
              </Button>
            </Link>
          )}
          {/* Trei butoane conturate deveniseră unul singur: vezi `UserMenu`
              pentru cei 44 de pixeli de antet pe care îi câștigă pe telefon și
              pentru motivul care contează mai mult decât ei. */}
          <UserMenu profile={profile} />
        </div>
      </div>
    </header>
  );
}
