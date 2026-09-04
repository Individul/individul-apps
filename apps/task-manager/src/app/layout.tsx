import type { Metadata } from "next";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AppHeader } from "@/components/layout/app-header";
import {
  getCurrentProfile,
  getCurrentUserId,
  getNotifications,
  getUnreadCount,
} from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sarcini · Secția evidența deținuți",
  description: "Gestionarea sarcinilor — Secția evidența deținuți",
};

/**
 * Antetul stă aici, nu în fiecare pagină.
 *
 * Îl desenau singure șaisprezece pagini, și de acolo venea o bună parte din
 * impresia că aplicația e mai înceată decât hub-ul vechi. Ce stă într-un layout
 * rămâne montat între pagini; ce stă în pagină se aruncă și se face din nou.
 * Așa că fiecare clic ștergea bara, tab-urile și clopoțelul, le lăsa lipsă cât
 * ținea randarea pe server, apoi le punea înapoi — adică semăna leit cu o
 * reîncărcare de pagină, chiar dacă nu era.
 *
 * Acum se schimbă doar ce e sub antet, iar `loading.tsx` de alături pune pe loc
 * un schelet în locul lui. Clicul are din nou un răspuns imediat.
 *
 * Layout-ul rădăcină nu se re-randează la navigare, deci datele de aici sunt
 * cele de la deschiderea aplicației. Nu e o scăpare: clopoțelul e abonat la
 * schimbări în timp real și se ține singur la zi, iar numele din profil se
 * împrospătează prin `router.refresh()` după salvare.
 *
 * Fără utilizator nu se desenează nimic — așa rămâne pagina de autentificare
 * curată, fără o listă de adrese publice ținută la zi pe alături. Hotărăște
 * sesiunea, nu profilul: un cont fără rând în `profiles` ar rămâne altfel fără
 * bară, deci fără butonul de deconectare, adică fără nicio ieșire.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [uid, profile, notifications, unread] = await Promise.all([
    getCurrentUserId(),
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
  ]);

  return (
    <html lang="ro">
      <body>
        {uid && <AppHeader profile={profile} notifications={notifications} unread={unread} />}
        {children}
        <Toaster richColors position="top-right" />
        <SpeedInsights />
      </body>
    </html>
  );
}
