import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AppHeaderSchelet, AppHeaderSlot } from "@/components/layout/app-header-slot";
import { ANTET_SESIUNE } from "@/lib/session-header";
import "./globals.css";

/**
 * Inter — fontul celorlalte aplicații de pe dumitru.cloud.
 *
 * Până acum era doar numit: `globals.css` scria `font-family: 'Inter', …` și
 * `tailwind.config.ts` îl trecea la `font-sans`, dar nimic nu-l aducea vreodată
 * — nici `<link>`, nici `next/font`. Așa că aplicația rula în Segoe UI, iar de
 * acolo venea cea mai mare parte din impresia că nu seamănă cu vecinele ei.
 *
 * `latin-ext`, nu doar `latin`: ă, â, î, ș și ț stau în extensie. Fără ea,
 * fiecare cuvânt cu diacritice ar fi împrumutat literele de la fontul de
 * rezervă — adică exact cuvintele românești ar fi ieșit din rând.
 *
 * Prin `next/font`, nu prin Google Fonts ca în portal: fișierele se descarcă la
 * construire și se servesc de pe domeniul nostru. Portalul e o pagină publică
 * de prezentare; asta e o aplicație de serviciu, iar o cerere către Google la
 * fiecare deschidere ar spune cuiva din afară cine intră și când. În plus,
 * fontul sosește odată cu pagina, deci textul nu mai sare la încărcare.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

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
 * Layout-ul nu așteaptă nimic el însuși. Prima oară l-am scris cu `await` pe
 * datele antetului, și asta ținea pe loc tot ce venea după: nu pleca niciun
 * octet până nu se întorcea autentificarea, deci nici scheletul paginii nu
 * apărea mai devreme — adică tocmai ce voiam să reparăm rămânea în urma unui
 * drum prin rețea. Acum antetul curge sub `Suspense`, iar `loading.tsx` de
 * alături desenează conținutul pe loc.
 *
 * Layout-ul rădăcină nu se re-randează la navigare, deci datele antetului sunt
 * cele de la deschiderea aplicației. Nu e o scăpare: clopoțelul e abonat la
 * schimbări în timp real și se ține singur la zi, iar numele din profil se
 * împrospătează prin `router.refresh()` după salvare.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Doar ca să știm dacă rezervăm locul barei. Fără indiciul ăsta, pagina de
  // autentificare ar arăta o clipă un schelet de bară, care apoi dispare.
  const areSesiune = headers().get(ANTET_SESIUNE) === "1";

  return (
    <html lang="ro" className={inter.variable}>
      <body>
        {areSesiune && (
          <Suspense fallback={<AppHeaderSchelet />}>
            <AppHeaderSlot />
          </Suspense>
        )}
        {children}
        <Toaster richColors position="top-right" />
        <SpeedInsights />
      </body>
    </html>
  );
}
