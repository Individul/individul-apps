import { AppHeader } from "@/components/layout/app-header";
import { ModuleTabs } from "@/components/layout/module-tabs";
import {
  getCurrentProfile,
  getCurrentUserId,
  getNotifications,
  getUnreadCount,
} from "@/lib/queries";

/**
 * Antetul, cu datele lui, ținut deoparte ca să nu oprească restul paginii.
 *
 * Când layout-ul rădăcină aștepta el însuși aceste trei interogări, nu pleca
 * niciun octet până nu se întorceau toate — deci nici scheletul de la
 * `loading.tsx` nu apărea mai devreme decât autentificarea. Adică fix ce voiam
 * să reparăm rămânea în urma unui drum prin rețea de vreo sută de milisecunde.
 *
 * Așezat sub un `Suspense`, layout-ul rămâne fără așteptare: HTML-ul pleacă pe
 * loc cu bara desenată gol, iar numele, clopoțelul și butoanele intră în ea
 * când sosesc. Conținutul paginii nu le mai așteaptă deloc.
 */
export async function AppHeaderSlot() {
  const [uid, profile, notifications, unread] = await Promise.all([
    getCurrentUserId(),
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
  ]);

  // Fără sesiune nu se arată bara — așa rămâne curată pagina de autentificare.
  // Hotărăște sesiunea, nu profilul: un cont fără rând în `profiles` ar rămâne
  // altfel fără bară, deci fără butonul de deconectare, adică fără nicio ieșire.
  if (!uid) return null;

  return <AppHeader profile={profile} notifications={notifications} unread={unread} />;
}

/**
 * Bara desenată înainte să se știe cine e conectat.
 *
 * Poartă tab-urile adevărate — ele nu depind de nimic din baza de date și sunt
 * chiar lucrul după care se întinde mâna. Lipsesc doar cele care cer un
 * răspuns: numele, clopoțelul, butoanele din dreapta.
 *
 * Aceleași înălțimi și aceleași goluri ca bara adevărată, ca să nu sară pagina
 * sub ea când sosesc datele.
 */
export function AppHeaderSchelet() {
  return (
    <header className="no-print border-b bg-card">
      <div className="mx-auto flex max-w-[1536px] flex-wrap items-center gap-3 p-4 xl:px-10">
        <span className="text-sm font-medium">Acasă</span>
        <ModuleTabs />
        {/* Aceeași formă ca blocul din dreapta al barei adevărate: clopoțelul și
            meniul de cont, cu aceeași pliere pe ecrane înguste. Până la meniul
            de cont aici erau trei butoane fără pliere — pe telefon scheletul ar
            fi ieșit tocmai în lățime, exact ce repară bara adevărată.
            „Administrare" nu are loc rezervat: nu se știe încă cine e conectat,
            deci la admin bara se lățește cu un buton când sosește. */}
        <div aria-hidden className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-16 animate-pulse rounded-md bg-muted sm:w-40" />
        </div>
      </div>
    </header>
  );
}
