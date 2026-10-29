import { format } from "date-fns";
import { ro } from "date-fns/locale";

import {
  CATEGORY_LABEL,
  REGIME_LABEL,
  categoryOf,
  fullName,
  type Defendant,
  type DefendantCategoryFilter,
} from "@/lib/defendants";
import { parseISODate, todayInChisinau } from "@/lib/periods";

const TITLU: Record<DefendantCategoryFilter, string> = {
  toti: "Lista preveniților și inculpaților",
  prevenit: "Lista preveniților",
  inculpat: "Lista inculpaților",
};

/**
 * Lista preveniților și inculpaților, așa cum iese pe hârtie (29.10.2026).
 *
 * Pe ecran nu se vede (`hidden print:block`), ca foaia planificării
 * transferurilor (`PlanPrint`): lista de pe ecran are butoane și coloane
 * gândite pentru mouse. Aici e un tabel simplu, numerotat, în ordinea
 * alfabetică a listei.
 *
 * Se tipărește ce se vede: toată lista sau doar o categorie, după pastile, și
 * doar cei găsiți, dacă s-a căutat ceva. Foaia o spune, ca o listă cu trei
 * nume să nu fie luată drept tot registrul. Condamnații nu intră: nu mai sunt
 * în grija secției ca preveniți sau inculpați.
 */
export function DefendantPrint({
  rows,
  category,
  search,
}: {
  rows: Defendant[];
  category: DefendantCategoryFilter;
  search: string;
}) {
  const preveniti = rows.filter((d) => categoryOf(d) === "prevenit").length;
  const inchis = rows.filter((d) => d.regime === "inchis").length;
  return (
    <section className="hidden text-[12px] leading-snug text-black print:block">
      <header className="mb-4 space-y-0.5 text-center">
        <p className="text-[11px] uppercase tracking-wide">Secția evidența deținuți</p>
        <h1 className="text-base font-semibold">{TITLU[category]}</h1>
        {/* Doar ziua, fără oră: se scrie și pe server, și în browser. */}
        <p suppressHydrationWarning>
          Întocmită la {format(todayInChisinau(), "d MMMM yyyy", { locale: ro })}
        </p>
        {search.trim() && <p className="italic">Doar cei găsiți după „{search.trim()}”</p>}
      </header>

      {rows.length === 0 ? (
        <p className="text-center">Nicio persoană în listă.</p>
      ) : (
        <table className="w-full table-fixed border-collapse border border-black">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[21%]" />
            <col className="w-[21%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
          </colgroup>
          {/* `thead` se repetă pe fiecare pagină tipărită (globals.css). */}
          <thead>
            <tr className="text-left">
              <th className="border border-black px-1.5 py-1 text-center font-semibold">Nr.</th>
              <th className="border border-black px-1.5 py-1 font-semibold">Numele și prenumele</th>
              <th className="border border-black px-1.5 py-1 font-semibold">Instanța</th>
              <th className="border border-black px-1.5 py-1 font-semibold">Dosarul</th>
              <th className="border border-black px-1.5 py-1 font-semibold">Categoria</th>
              <th className="border border-black px-1.5 py-1 font-semibold">Tipul</th>
              <th className="border border-black px-1.5 py-1 font-semibold">Stabilit</th>
              <th className="border border-black px-1.5 py-1 font-semibold">Observații</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.id} className="align-top">
                <td className="border border-black px-1.5 py-1 text-center tabular-nums">{i + 1}</td>
                <td className="border border-black px-1.5 py-1 font-medium">{fullName(d)}</td>
                <td className="border border-black px-1.5 py-1">{d.court ?? "—"}</td>
                <td className="border border-black px-1.5 py-1 tabular-nums">{d.case_number ?? "—"}</td>
                <td className="border border-black px-1.5 py-1">
                  {CATEGORY_LABEL[categoryOf(d)]}
                  {d.preventive_measure_on && (
                    <span className="block text-[11px]">
                      din {format(parseISODate(d.preventive_measure_on), "d MMM yyyy", { locale: ro })}
                    </span>
                  )}
                </td>
                <td className="border border-black px-1.5 py-1">{REGIME_LABEL[d.regime]}</td>
                <td className="border border-black px-1.5 py-1 tabular-nums">
                  {format(parseISODate(d.established_on), "d MMM yyyy", { locale: ro })}
                </td>
                <td className="border border-black px-1.5 py-1">{d.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rows.length > 0 && (
        <p className="mt-2 text-right font-medium">
          Total: {rows.length} {rows.length === 1 ? "persoană" : "persoane"}
          {category === "toti" && ` (${preveniti} preveniți, ${rows.length - preveniti} inculpați)`}
          {` · ${inchis} închis, ${rows.length - inchis} semiînchis`}
        </p>
      )}
    </section>
  );
}
