import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { dataPlanului, ziuaTransferului } from "@/components/transfers/plan-format";
import { esteInstiintat, termenDepasit, termenLimita, type PlanGroup } from "@/lib/transfer-plans";
import { institutionLabel } from "@/lib/transfers";
import { parseISODate, todayInChisinau } from "@/lib/periods";

/**
 * Lista celor preconizați pentru transfer, așa cum iese pe hârtie.
 *
 * Pe ecran nu se vede (`hidden print:block`): lista interactivă are butoane,
 * culori de stare și coloane fixe gândite pentru mouse, care pe hârtie ar fi
 * zgomot. Aici e un tabel simplu pe fiecare zi de transfer, cu numerotare,
 * care se poate preda escortei sau pune la dosar.
 *
 * Se tipărește ce e în `groups`: toată lista (sau ce a rămas după căutare),
 * ori o singură zi, aleasă din capul grupului. `selectie` spune pe hârtie
 * care dintre ele e, ca o foaie cu trei nume să nu fie luată drept lista
 * întreagă.
 */
export function PlanPrint({ groups, selectie }: { groups: PlanGroup[]; selectie: string | null }) {
  const total = groups.reduce((n, g) => n + g.plans.length, 0);
  return (
    <section className="hidden text-[12px] leading-snug text-black print:block">
      <header className="mb-4 space-y-0.5 text-center">
        <p className="text-[11px] uppercase tracking-wide">Secția evidența deținuți</p>
        <h1 className="text-base font-semibold">Lista persoanelor preconizate pentru transfer</h1>
        {/* Doar ziua, fără oră: e scrisă pe server și în browser, iar ora ar
            diferi între ele. În jurul miezului nopții poate diferi și ziua. */}
        <p suppressHydrationWarning>
          Întocmită la {format(todayInChisinau(), "d MMMM yyyy", { locale: ro })}
        </p>
        {selectie && <p className="italic">{selectie}</p>}
      </header>

      {groups.length === 0 ? (
        <p className="text-center">Nicio persoană în așteptarea transferului.</p>
      ) : (
        groups.map((g) => {
          const imposibil = g.day === null;
          return (
            <div key={g.day ?? "imposibil"} className="mb-5 break-inside-avoid-page">
              <h2 className="mb-1 text-[13px] font-semibold">
                {imposibil
                  ? "Fără zi de transfer înainte de ședință — instanța se înștiințează"
                  : `Transfer pe ${ziuaTransferului(g.day!)}`}
                <span className="ml-2 font-normal">({g.plans.length})</span>
              </h2>
              {/* Lățimi fixe: altfel fiecare zi își potrivea singură coloanele, iar
                  tabelele de pe aceeași foaie nu stăteau unul sub altul. */}
              <table className="w-full table-fixed border-collapse border border-black">
                <colgroup>
                  <col className="w-[6%]" />
                  <col className="w-[19%]" />
                  <col className="w-[22%]" />
                  <col className="w-[14%]" />
                  <col className="w-[15%]" />
                  <col className="w-[24%]" />
                </colgroup>
                {/* `thead` se repetă pe fiecare pagină tipărită (globals.css). */}
                <thead>
                  <tr className="text-left">
                    <th className="border border-black px-1.5 py-1 text-center font-semibold">Nr.</th>
                    <th className="border border-black px-1.5 py-1 font-semibold">Numele și prenumele</th>
                    <th className="border border-black px-1.5 py-1 font-semibold">Instanța</th>
                    <th className="border border-black px-1.5 py-1 font-semibold">Penitenciarul</th>
                    <th className="border border-black px-1.5 py-1 font-semibold">Temeiul și data</th>
                    <th className="border border-black px-1.5 py-1 font-semibold">Observații</th>
                  </tr>
                </thead>
                <tbody>
                  {g.plans.map((p, i) => {
                    const obs: string[] = [];
                    if (p.basis === "termen30" && termenLimita(p)) {
                      const limita = format(parseISODate(termenLimita(p)!), "d MMM yyyy", { locale: ro });
                      obs.push(termenDepasit(p) ? `termen depășit (${limita})` : `termen ${limita}`);
                    }
                    if (imposibil && esteInstiintat(p)) {
                      obs.push(`înștiințare expediată ${format(new Date(p.notified_at!), "d MMM", { locale: ro })}`);
                    }
                    if (p.note) obs.push(p.note);
                    return (
                      <tr key={p.id} className="align-top">
                        <td className="border border-black px-1.5 py-1 text-center tabular-nums">{i + 1}</td>
                        <td className="border border-black px-1.5 py-1 font-medium">
                          {p.last_name} {p.first_name}
                        </td>
                        <td className="border border-black px-1.5 py-1">{p.court ?? "—"}</td>
                        <td className="border border-black px-1.5 py-1">{institutionLabel(p.institution)}</td>
                        <td className="border border-black px-1.5 py-1 tabular-nums">
                          {dataPlanului(p)}
                        </td>
                        <td className="border border-black px-1.5 py-1">{obs.join("; ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {total > 0 && (
        <p className="mt-2 text-right font-medium">
          Total: {total} {total === 1 ? "persoană" : "persoane"}
        </p>
      )}
    </section>
  );
}
