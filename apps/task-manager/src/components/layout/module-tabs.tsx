"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MODULES = [
  { href: "/sarcini", label: "Sarcini", matchPrefixes: ["/sarcini", "/tasks"] },
  { href: "/petitii", label: "Petiții", matchPrefixes: ["/petitii"] },
  { href: "/sedinte", label: "Ședințe", matchPrefixes: ["/sedinte"] },
  { href: "/transferuri", label: "Transferuri", matchPrefixes: ["/transferuri"] },
  // Numele întreg, deși e lung: „Inculpați" numea jumătate din registru, iar
  // „Preveniți" ar numi cealaltă jumătate. Adresa rămâne /inculpati — o
  // schimbare de adresă ar rupe legăturile din notificări și din însemnări
  // vechi, fără să câștige nimic.
  { href: "/inculpati", label: "Preveniți și inculpați", matchPrefixes: ["/inculpati"] },
  { href: "/obligatii", label: "Informări", matchPrefixes: ["/obligatii"] },
  { href: "/statistici", label: "Statistici", matchPrefixes: ["/statistici"] },
] as const;

export function ModuleTabs() {
  const pathname = usePathname();
  return (
    /*
     * Se pliază, nu se derulează.
     *
     * Șapte file pe un rând fac vreo 500px. Fără `flex-wrap`, `nav` e un singur
     * element de flex care nici nu se rupe, nici nu se micșorează sub lățimea
     * conținutului — deci pe un telefon de 375px ieșea din ecran și împingea
     * întregul document: `scrollWidth` 554 pe *fiecare* pagină a aplicației,
     * nu doar aici. Antetul e comun, deci și defectul era comun.
     *
     * Cealaltă reparație la îndemână era `overflow-x-auto` pe filele astea. Ar
     * fi ținut antetul scund, dar ar fi ascuns ultimele patru file în spatele
     * unui gest de glisare — iar într-un instrument de lucru pe care omul îl
     * deschide de câteva ori pe lună de pe telefon, o filă pe care n-o vezi e
     * o filă care nu există. Un antet mai înalt se plătește o dată, la fiecare
     * încărcare; o filă nedescoperită se plătește o dată, pentru totdeauna.
     *
     * `min-w-0` e explicit, deși un container care se pliază s-ar micșora și
     * fără el: fără regula asta scrisă, prima filă mai lungă adăugată aici
     * readuce tăcut derularea de la care am plecat.
     */
    <nav className="flex min-w-0 flex-wrap items-center gap-1">
      {MODULES.map((m) => {
        const active = m.matchPrefixes.some(
          (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        );
        return (
          <Link
            key={m.href}
            href={m.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
