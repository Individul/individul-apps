import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarDays } from "lucide-react";
import { institutionLabel, type InstitutionCounts, type TransferTotals } from "@/lib/transfers";
import { cn } from "@/lib/utils";

/**
 * Transferurile, alături de cardurile de modul.
 *
 * Nu folosește `ModuleCard` fiindcă n-are ce căuta în forma aceea: modulul
 * n-are responsabil, deci nici defalcare pe persoane.
 *
 * Două așezări, după cât loc primește. Pe două coloane ia rândul întreg, sub
 * celelalte două carduri — trei nu se împart la două — și atunci lățimea e
 * folosită pe orizontală: cifrele în stânga, penitenciarele în dreapta. Pe
 * ecranul lat (`2xl`) stă în a treia coloană, iar acolo penitenciarele coboară
 * sub cifre: alături nu mai încap, iar linia dintre ele ar rămâne desenată pe
 * un bloc trecut deja pe rândul următor.
 *
 * E o coloană `flex`, cu nota despre următorul transfer împinsă la bază: în
 * grilă cardurile de pe un rând se întind la înălțimea celui mai înalt, iar
 * nota ar fi rămas altfel suspendată la mijloc, cu gol sub ea.
 */
export function TransferBand({
  totals,
  institutions,
  nextTransfer,
  className,
}: {
  totals: TransferTotals;
  /** Doar penitenciarele cu mișcare în perioadă, deja ordonate. */
  institutions: InstitutionCounts[];
  /** Data următorului transfer programat, gata formatată. */
  nextTransfer: string;
  /** Pentru locul din grilă (câte coloane ocupă), dat de pagină. */
  className?: string;
}) {
  return (
    <Link
      href="/transferuri"
      className={cn(
        "flex flex-col rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20 hover:bg-muted/40",
        className,
      )}
    >
      <h2 className="text-xl font-medium">Transferuri</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Transferurile deținuților între penitenciare, în luna curentă.
      </p>

      <div className="mt-5 flex flex-wrap items-start gap-x-8 gap-y-5">
        <div className="flex gap-8">
          {[
            { label: "Plecați", value: totals.plecati },
            { label: "Sosiți", value: totals.sositi },
            { label: "Sold", value: totals.sold },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-medium tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {institutions.length > 0 && (
          // Chenarul din stânga apare doar de la lățimea la care cele două
          // blocuri chiar stau alături; înghesuite pe un rând nou ar tăia
          // aiurea.
          <div className="min-w-[14rem] flex-1 sm:border-l sm:pl-8 2xl:basis-full 2xl:border-l-0 2xl:border-t 2xl:pl-0 2xl:pt-4">
            <div className="text-[11px] text-muted-foreground">Penitenciare</div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm tabular-nums">
              {institutions.map((r) => (
                <span key={r.institution} className="flex items-center gap-1">
                  <span className="text-muted-foreground">
                    {institutionLabel(r.institution).replace("Penitenciarul ", "")}
                  </span>
                  {/* Săgețile diferă și ca direcție, nu doar ca culoare: cine
                      nu distinge roșu de verde citește corect după formă. */}
                  {r.plecati > 0 && (
                    <span className="flex items-center">
                      <ArrowUp className="h-3 w-3 text-red-600" aria-hidden="true" />
                      {r.plecati}
                    </span>
                  )}
                  {r.sositi > 0 && (
                    <span className="flex items-center">
                      <ArrowDown className="h-3 w-3 text-green-600" aria-hidden="true" />
                      {r.sositi}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Împinge nota la baza chenarului când grila îl întinde. */}
      <div className="flex-1" />
      <p className="mt-5 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {/* Într-o lună fără niciun rând, trei zerouri nu spun dacă n-a fost
            mișcare sau dacă n-a apucat nimeni să scrie. */}
        {institutions.length === 0 && "Niciun transfer înregistrat luna aceasta. "}
        Următorul transfer programat: {nextTransfer}
      </p>
    </Link>
  );
}
