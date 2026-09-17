import { formatDateRo } from "@/lib/periods";
import type { Coloana, Raport } from "@/lib/raport-activitate";

function Numar({ n }: { n: number }) {
  // Zero scris palid: ochiul trece peste el și rămâne la cifrele care spun ceva.
  return (
    <span className={n === 0 ? "tabular-nums text-muted-foreground" : "tabular-nums"}>{n}</span>
  );
}

/**
 * Lista lucrărilor încheiate de un om — partea de „ce”, sub cifre.
 *
 * La tipărire lista curge peste pagini; nu se ține întreagă. Ținută, o lună cu
 * douăzeci de petiții nu mai încăpea sub tabel și pleca pe foaia următoare,
 * lăsând o jumătate de pagină albă — pe hârtie, într-o dare de seamă lunară,
 * asta se vede. Se lipesc doar titlurile de rândul care le urmează
 * (`break-after-avoid`), ca niciun nume să nu rămână singur la subsol.
 */
function Lista({ titlu, coloana }: { titlu: string; coloana: Coloana }) {
  if (coloana.incheiate.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1 break-after-avoid text-xs font-medium text-muted-foreground print:text-black">
        {titlu} ({coloana.incheiate.length})
      </h4>
      <ul className="space-y-0.5">
        {coloana.incheiate.map((x) => (
          <li key={x.id} className="flex break-inside-avoid gap-2 text-[13px]">
            <span className="w-24 shrink-0 tabular-nums text-muted-foreground print:text-black">
              {formatDateRo(x.zi)}
            </span>
            <span className="min-w-0 flex-1">{x.eticheta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface RaportActivitateProps {
  raport: Raport;
  /** Intervalul scris în litere, sub titlu. */
  eticheta: string;
  intocmitDe: string;
  /** Ceasul de la server, scris gata format — vezi pagina. */
  intocmitLa: string;
}

/**
 * Foaia raportului: tot ce se vede și se tipărește, nimic din ce se aduce.
 *
 * Ținută deoparte de pagină fiindcă pagina e o componentă de server legată de
 * Supabase — adică nu se poate deschide nicăieri fără cont. Aici, primind un
 * `Raport` gata făcut, foaia se poate desena într-o probă și privită înainte de
 * a fi publicată, la lățimea ecranului și pe hârtie.
 */
export function RaportActivitate({
  raport,
  eticheta,
  intocmitDe,
  intocmitLa,
}: RaportActivitateProps) {
  const celule = (c: Coloana) => (
    <>
      <td className="px-2 py-1.5 text-right font-medium">
        <Numar n={c.incheiate.length} />
      </td>
      <td className="px-2 py-1.5 text-right">
        <Numar n={c.intrate} />
      </td>
      <td className="px-2 py-1.5 text-right">
        <Numar n={c.ramase} />
      </td>
    </>
  );

  return (
      <article className="space-y-6 text-[13px] leading-relaxed">
        <header className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground print:text-black">
            Secția evidența deținuți
          </p>
          <h1 className="text-lg font-semibold">Raport de activitate pe responsabili</h1>
          <p className="text-muted-foreground print:text-black">{eticheta}</p>
        </header>

        <section>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse">
              <thead>
                <tr className="border-y bg-muted/40">
                  <th rowSpan={2} className="px-3 py-1.5 text-left font-medium">
                    Responsabil
                  </th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center font-medium">
                    Sarcini
                  </th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center font-medium">
                    Petiții
                  </th>
                </tr>
                <tr className="border-b bg-muted/40 text-[12px]">
                  <th className="border-l px-2 py-1 text-right font-medium">Încheiate</th>
                  <th className="px-2 py-1 text-right font-medium">Intrate</th>
                  <th className="px-2 py-1 text-right font-medium">Rămase</th>
                  <th className="border-l px-2 py-1 text-right font-medium">Încheiate</th>
                  <th className="px-2 py-1 text-right font-medium">Intrate</th>
                  <th className="px-2 py-1 text-right font-medium">Rămase</th>
                </tr>
              </thead>
              <tbody>
                {raport.randuri.map((r) => (
                  <tr key={r.id || "fara"} className="border-b">
                    <td className="px-3 py-1.5">{r.nume}</td>
                    {celule(r.sarcini)}
                    {celule(r.petitii)}
                  </tr>
                ))}
                <tr className="border-b-2 border-t-2 font-semibold">
                  <td className="px-3 py-1.5">Total</td>
                  {celule(raport.total.sarcini)}
                  {celule(raport.total.petitii)}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-muted-foreground print:text-black">
            „Încheiate” sunt sarcinile trecute pe „Gata” și petițiile la care a plecat
            răspunsul în perioadă. „Intrate” — cele scrise în registru în perioadă.
            „Rămase” — câte erau încă deschise în ultima zi a ei. Responsabilul e cel de
            acum: o lucrare mutată între timp de la un om la altul apare la cel de azi.
          </p>

          {/* Ce nu poate intra în nicio perioadă se spune, nu se ascunde: altfel
              totalul anului n-ar da suma lunilor și n-ar ști nimeni de ce. */}
          {(raport.faraData.sarcini > 0 || raport.faraData.petitii > 0) && (
            <p className="mt-1 text-xs text-muted-foreground print:text-black">
              Nu intră în nicio perioadă, fiindcă le lipsește data încheierii:{" "}
              {raport.faraData.sarcini > 0 && (
                <>
                  {raport.faraData.sarcini}{" "}
                  {raport.faraData.sarcini === 1 ? "sarcină" : "sarcini"}
                </>
              )}
              {raport.faraData.sarcini > 0 && raport.faraData.petitii > 0 && ", "}
              {raport.faraData.petitii > 0 && (
                <>
                  {raport.faraData.petitii}{" "}
                  {raport.faraData.petitii === 1 ? "petiție" : "petiții"}
                </>
              )}
              .
            </p>
          )}
        </section>

        <section className="space-y-5">
          <h2 className="break-after-avoid text-sm font-medium">Ce s-a încheiat</h2>
          {raport.total.sarcini.incheiate.length + raport.total.petitii.incheiate.length === 0 ? (
            <p className="text-muted-foreground print:text-black">
              Nicio sarcină și nicio petiție încheiată în perioada asta.
            </p>
          ) : (
            raport.randuri
              .filter(
                (r) => r.sarcini.incheiate.length + r.petitii.incheiate.length > 0,
              )
              .map((r) => (
                <div key={r.id || "fara"} className="space-y-2">
                  <h3 className="break-after-avoid border-b pb-1 font-medium">{r.nume}</h3>
                  <Lista titlu="Sarcini" coloana={r.sarcini} />
                  <Lista titlu="Petiții" coloana={r.petitii} />
                </div>
              ))
          )}
        </section>

        <footer className="flex justify-between border-t pt-3 text-xs text-muted-foreground print:text-black">
          <span>Întocmit: {intocmitDe}</span>
          <span>{intocmitLa}</span>
        </footer>
      </article>

  );
}
