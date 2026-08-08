import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { parseISODate, rangeLabelRo, type DateRange } from "@/lib/periods";
import type { WeeklyFigures } from "@/lib/weekly-report";

interface ReportViewProps {
  week: DateRange;
  /**
   * Cifrele săptămânii, toate patru din `weeklyFigures`. Componenta nu adună
   * nimic: aceeași funcție hrănește și PDF-ul, deci hârtia și ecranul nu se pot
   * contrazice — vezi comentariul din `lib/weekly-report.ts`.
   */
  figures: WeeklyFigures;
  /** Zilele lucrătoare fără ședințe introduse (`missingWorkdays`). */
  missing: string[];
  /** A putut fi citit registrul eliberărilor? Vezi `getReleases`. */
  releasesAvailable: boolean;
  /** Cine prezintă raportul, pentru subsol. */
  author: string | null;
}

/**
 * O cifră mare cu eticheta ei. `value` null înseamnă „nu se știe" și se scrie
 * „—": un zero ar fi o afirmație, iar aici nu avem ce afirma.
 */
function Figure({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div>
      <div className="text-3xl font-medium tabular-nums">
        {value === null ? <span className="text-muted-foreground print:text-black">—</span> : value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground print:text-black">{label}</div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-muted-foreground print:text-black">{hint}</div>
      )}
    </div>
  );
}

/** Avertizările se tipăresc odată cu cifrele — vezi de ce mai jos. */
function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="break-inside-avoid rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 print:rounded-none print:border-black print:bg-transparent print:text-black">
      {children}
    </div>
  );
}

/**
 * Raportul propriu-zis: partea care ajunge pe hârtie.
 *
 * Componentă de server, fără interactivitate: navigarea între săptămâni și
 * butoanele de export stau în afara ei, tocmai ca tot ce se tipărește să nu
 * ceară JavaScript în browser.
 */
export function ReportView({
  week,
  figures,
  missing,
  releasesAvailable,
  author,
}: ReportViewProps) {
  return (
    <article className="space-y-4">
      <header className="space-y-1 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground print:text-black">
          Secția evidența deținuți
        </p>
        <h1 className="text-lg font-semibold">Date statistice</h1>
        <p className="text-[13px] text-muted-foreground print:text-black">
          {rangeLabelRo(week)}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 sm:grid-cols-4 print:grid-cols-4 print:rounded-none print:border-black">
        <Figure label="Plecați" value={figures.plecati} />
        <Figure label="Sosiți" value={figures.sositi} />
        {/* Totalul e petrecute + amânate; nu trebuie să ascundă din ce se face. */}
        <Figure
          label="Teleconferințe"
          value={figures.teleconferinte}
          hint={`din care amânate: ${figures.amanate}`}
        />
        <Figure label="Eliberați" value={releasesAvailable ? figures.eliberati : null} />
      </div>

      {/*
        Avertizările stau înaintea butoanelor de export, nu după: un raport
        tipărit cu o cifră incompletă nu se mai poate retrage. Se și tipăresc,
        din același motiv — o hârtie care tace despre golurile ei lasă impresia
        că săptămâna e acoperită integral.
      */}
      {missing.length > 0 && (
        <Warning>
          <span className="font-medium">
            {missing.length} {missing.length === 1 ? "zi lucrătoare" : "zile lucrătoare"} fără
            ședințe introduse:
          </span>{" "}
          {missing.map((iso) => format(parseISODate(iso), "d MMM", { locale: ro })).join(", ")}.
          Teleconferințele de mai sus numără doar zilele introduse, deci cifra e mai mică decât
          realitatea.{" "}
          <Link href="/sedinte" className="no-print underline underline-offset-2">
            Completează la Ședințe →
          </Link>
        </Warning>
      )}

      {!releasesAvailable && (
        <Warning>
          <span className="font-medium">Registrul eliberărilor nu poate fi citit.</span> Cel mai
          probabil migrarea <span className="font-mono">0026_releases.sql</span> n-a fost aplicată
          pe baza de date. Cifra e scrisă „—”, nu 0: zeroul ar spune că săptămâna a fost
          verificată și n-a ieșit nimeni. Celelalte trei cifre sunt întregi.
        </Warning>
      )}

      <footer className="flex justify-between border-t pt-3 text-xs text-muted-foreground print:text-black">
        <span>Întocmit: {author ?? "—"}</span>
        {/* Ora Chișinăului, spusă explicit: serverul merge pe UTC, iar un act
            oficial cu ceasul dat înapoi ridică întrebări la dosar. */}
        <span>
          {new Intl.DateTimeFormat("ro-RO", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Europe/Chisinau",
          }).format(new Date())}
        </span>
      </footer>
    </article>
  );
}
