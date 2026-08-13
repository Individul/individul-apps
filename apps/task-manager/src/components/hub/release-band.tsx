import Link from "next/link";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { ArrowRight, CheckCheck } from "lucide-react";

import { parseISODate } from "@/lib/periods";
import {
  fullName,
  groundLabel,
  monthLabelRo,
  type MonthSummary,
  type ReleaseState,
} from "@/lib/releases";
import { cn } from "@/lib/utils";

/**
 * Cele două stări care mai cer ceva de la om.
 *
 * Semnul e cuvântul, nu culoarea. „AZI" și „RESTANT" se citesc la fel pe un
 * ecran alb-negru, la o hârtie fotocopiată sau de cineva care nu distinge roșu
 * de portocaliu — aceeași hotărâre ca la săgețile din `transfer-band.tsx:62`,
 * care diferă întâi ca direcție. Culoarea vine deasupra și repetă ce scrie deja.
 *
 * Roșu peste portocaliu, ca în `obligation-band.tsx`: ziua ratată e mai gravă
 * decât ziua de azi. Dacă ordinea s-ar inversa între două chenare ale aceleiași
 * pagini, culorile n-ar mai însemna nimic nicăieri.
 *
 * `viitor` și `gata` lipsesc din hartă fiindcă n-au pastilă: primul e cursul
 * normal al lucrurilor, al doilea nici nu ajunge în listă.
 */
const PILL: Partial<Record<ReleaseState, { label: string; className: string }>> = {
  restant: { label: "restant", className: "border-red-300 bg-red-100 text-red-900" },
  azi: { label: "azi", className: "border-orange-300 bg-orange-100 text-orange-900" },
};

/**
 * Eliberările lunii curente, pe toată lățimea paginii de start.
 *
 * Chenarul întreg **nu** e un `<Link>`, spre deosebire de `TransferBand`.
 * Rândurile urmează să primească bifa „eliberat" chiar aici, iar un link părinte
 * ar înghiți clicul pe ea: omul ar ajunge pe altă pagină în loc să bifeze, și
 * n-ar avea de unde ghici de ce. Legătura stă jos, singură și explicită.
 */
export function ReleaseBand({
  summary,
  month,
  responsible,
}: {
  summary: MonthSummary;
  /** `AAAA-LL` — pentru titlu și pentru adresa paginii. */
  month: string;
  /** Numele celor bifați, sau `null` dacă nu e bifat nimeni. */
  responsible: string | null;
}) {
  const luna = monthLabelRo(month);

  return (
    <section className="mb-6 rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-xl font-medium">
          Eliberări <span className="text-base font-normal text-muted-foreground">· {luna}</span>
        </h2>
        {/* Fără rândul „nimeni desemnat" când nu e nimeni: vezi
            `responsibleLabel`. O lipsă anunțată zilnic nu duce la nicio faptă,
            fiindcă bifa se pune din pagina de administrare, nu de aici. */}
        {responsible && (
          <p className="text-xs text-muted-foreground">Responsabil: {responsible}</p>
        )}
      </div>

      {/* Cifrele stau pe loc cât timp luna are măcar un rând, chiar și după ce
          lista de dedesubt s-a golit: ce se schimbă între stări e lista, nu
          antetul, iar un rând care apare și dispare ar face capul chenarului să
          sară sub ochi de la o zi la alta. */}
      {summary.total > 0 && (
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
          {summary.total} în total · {summary.done} înregistrate · {summary.remaining.length}{" "}
          rămase
        </p>
      )}

      {summary.remaining.length > 0 ? (
        // Coloane, nu o listă lungă: într-o lună obișnuită sunt până la
        // cincisprezece nume, iar pe verticală chenarul ar împinge cardurile
        // afară din primul ecran — adică ar strica pagina ca să câștige un
        // modul. Pe trei coloane, cincisprezece rânduri înseamnă cinci.
        //
        // Umplerea implicită a grilei e pe rânduri, nu pe coloane, și e bine
        // așa: lista vine sortată cu restanțele întâi, deci primul rând ține
        // cele mai urgente trei. Pe coloane, urgențele s-ar aduna toate în
        // stânga jos.
        <ul className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {summary.remaining.map(({ plan, state }) => {
            const pill = PILL[state];
            return (
              // `min-w-0` nu e decorativ: un element de grilă are implicit
              // `min-width: auto`, adică refuză să scadă sub lățimea propriului
              // conținut. Fără el rândul rămâne lat cât textul întreg, iese din
              // chenar și împinge pagina la derulare orizontală pe telefon —
              // iar `truncate` de pe temei nu se declanșează niciodată, fiindcă
              // nimeni nu-l strânge vreodată.
              <li
                key={plan.id}
                className="flex min-w-0 items-baseline gap-2 text-[13px] leading-6"
              >
                {/* Lățime fixă și aliniere la dreapta, ca „1 aug" și „14 aug" să
                    lase numele să înceapă în același loc pe toată coloana.
                    Ziua fără an și fără luna întreagă: anul și luna scriu deja
                    în titlu, iar „14 august 2026" pe fiecare rând ar mânca
                    lățimea de care are nevoie numele. */}
                <span className="w-[3.25rem] shrink-0 text-right tabular-nums text-muted-foreground">
                  {format(parseISODate(plan.release_date), "d MMM", { locale: ro })}
                </span>
                {/* Numele nu se taie niciodată — un „Constantines…" nu e om, e o
                    ghicitoare. Temeiul da: el se recunoaște și din început. */}
                <span className={cn("shrink-0", pill && "font-medium")}>{fullName(plan)}</span>
                <span className="truncate text-muted-foreground">
                  · {groundLabel(plan.ground)}
                </span>
                {pill && (
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold uppercase leading-4 tracking-wide",
                      pill.className,
                    )}
                  >
                    {pill.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : summary.total > 0 ? (
        // Două goluri diferite, două propoziții diferite. Aici luna a avut
        // eliberări și toate sunt duse la capăt — o veste bună, deci și bifa
        // verde. Un text comun cu cel de mai jos ar spune „nu mai e nimic de
        // făcut" și într-o lună în care nimeni n-a apucat să scrie nimic.
        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCheck className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
          {/* „Toate cele 1 eliberări" nu e română. Aceeași stare, forma
              gramaticală potrivită numărului. */}
          {summary.total === 1
            ? `Singura eliberare din ${luna} e înregistrată.`
            : `Toate cele ${summary.total} eliberări din ${luna} sunt înregistrate.`}
        </p>
      ) : (
        // Celălalt gol: registrul lunii e alb. Nu spune „gata", fiindcă nimeni
        // n-a început.
        <p className="mt-4 text-sm text-muted-foreground">
          Nicio eliberare înregistrată în {luna}.
        </p>
      )}

      {/* Luna trece explicit prin adresă, deși pagina cade oricum pe luna
          curentă: la 31 august seara, o pagină care și-ar citi singură ziua ar
          putea răspunde cu septembrie unui clic dat pe august. */}
      <p className="mt-5 flex justify-end border-t pt-3 text-xs">
        <Link
          href={`/eliberari?luna=${month}`}
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          Toate eliberările
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </p>
    </section>
  );
}
