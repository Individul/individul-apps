import Link from "next/link";
import { FileText } from "lucide-react";

import {
  getTaskCounts,
  getPetitionCounts,
  getProfiles,
  getCurrentProfile,
  getTransferCounts,
  getObligations,
  getReleasePlans,
} from "@/lib/queries";
import {
  taskStats,
  petitionStats,
  groupByAssignee,
  type TaskStats,
  type PetitionStats,
} from "@/lib/hub-stats";
import { aggregate, byInstitution, nextScheduled } from "@/lib/transfers";
import { formatDateRo, rangeForPeriod, todayInChisinau, toISODate } from "@/lib/periods";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/hub/global-search";
import { ModuleCard, type ModuleCardStat } from "@/components/hub/module-card";
import { TransferBand } from "@/components/hub/transfer-band";
import { ReleaseBand } from "@/components/hub/release-band";
import { ChangelogSection } from "@/components/hub/changelog-section";
import { ObligationBand } from "@/components/obligations/obligation-band";
import { pendingFor } from "@/lib/obligations";
import { monthSummary, responsibleLabel } from "@/lib/releases";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * O coloană a cardului. Din aceeași definiție ies toate cele trei locuri unde
 * apare cifra — cea mare, „din N” de sub ea și rândul fiecărei persoane din
 * defalcare — deci nu pot ajunge să se contrazică.
 */
interface Column<S> {
  label: string;
  title?: string;
  short?: string;
  get: (stats: S) => number;
  tone?: ModuleCardStat["tone"];
}

// „Scadente 7 zile” se rupea pe două rânduri și strica alinierea; detaliul
// trece în explicația de la hover.
const DUE_SOON = { label: "Scadente", title: "Scadente în următoarele 7 zile" } as const;

const TASK_COLUMNS: Column<TaskStats>[] = [
  { label: "Total", get: (s) => s.total },
  { label: "Active", get: (s) => s.active },
  { label: "În așteptare", short: "Așteptare", get: (s) => s.waiting },
  { label: "Finalizate", get: (s) => s.done },
  { ...DUE_SOON, get: (s) => s.dueSoon, tone: "warning" },
  { label: "Restante", get: (s) => s.overdue, tone: "danger" },
];

const PETITION_COLUMNS: Column<PetitionStats>[] = [
  { label: "Total", get: (s) => s.total },
  { label: "În examinare", short: "Examinare", get: (s) => s.open },
  { label: "Soluționate", short: "Soluț.", get: (s) => s.solved },
  { ...DUE_SOON, get: (s) => s.dueSoon, tone: "warning" },
  { label: "Restante", get: (s) => s.overdue, tone: "danger" },
];

function toStats<S>(columns: Column<S>[], mine: S, all: S | null): ModuleCardStat[] {
  return columns.map((c) => ({
    label: c.label,
    short: c.short,
    tone: c.tone,
    value: c.get(mine),
    of: all ? c.get(all) : undefined,
  }));
}

/** Câte un rând per responsabil, cu aceleași cifre ca ale cardului. */
function toBreakdown<T extends { assignee_id: string | null }, S>(
  items: T[],
  profiles: Profile[],
  columns: Column<S>[],
  statsOf: (items: T[]) => S,
) {
  return groupByAssignee(items, profiles).map((group) => {
    const stats = statsOf(group.items);
    return { id: group.id, name: group.name, values: columns.map((c) => c.get(stats)) };
  });
}

export default async function HubPage() {
  // Luna eliberărilor se citește pe ceasul Chișinăului, nu pe al serverului: pe
  // Vercel mașina merge pe UTC, iar în noaptea dintre 31 și 1 chenarul ar cere
  // baza de date pentru luna care tocmai s-a încheiat.
  //
  // Ziua se ține într-o variabilă și se dă mai departe, nu se citește de două
  // ori: între alegerea lunii și socoteala stărilor se poate schimba data, iar
  // atunci un rând de azi ar apărea drept restanță. Fereastra e de o clipă, dar
  // e chiar clipa în care cineva lucrează la miezul nopții.
  const azi = todayInChisinau();
  const luna = toISODate(azi).slice(0, 7);

  // Pagina de start nu arată niciun rând, ci unsprezece cifre și două tabele de
  // defalcare. Deci cere din baza de date doar coloanele din care ies cifrele:
  // titlurile, descrierile, responsabilii încorporați și fișierele atașate ale
  // celor trei registre ar traversa rețeaua ca să fie aruncate. Modulele lor
  // (/sarcini, /petitii, /transferuri) au mai departe rândurile întregi.
  const [tasks, petitions, profiles, profile, transfers, obligations, releasePlans] =
    await Promise.all([
      getTaskCounts(),
      getPetitionCounts(),
      getProfiles(),
      getCurrentProfile(),
      getTransferCounts(),
      getObligations(),
      getReleasePlans(luna),
    ]);

  const isAdmin = profile?.role === "admin";
  const me = profile?.id ?? null;

  // Adminul vede tot; membrul doar ce-i e atribuit.
  const myTasks = isAdmin ? tasks : tasks.filter((t) => t.assignee_id === me);
  const myPetitions = isAdmin ? petitions : petitions.filter((p) => p.assignee_id === me);

  const ts = taskStats(myTasks);
  const ps = petitionStats(myPetitions);

  // Membrul își vede cifrele proprii, cu totalul secției dedesubt („din N”).
  // Adminul le are deja pe toate, deci n-ar avea ce compara.
  const tsAll = isAdmin ? null : taskStats(tasks);
  const psAll = isAdmin ? null : petitionStats(petitions);

  // Registrul de transferuri e o evidență lunară: un total de la prima zi a
  // registrului n-ar spune nimic despre cum stă luna curentă. Datele sunt
  // AAAA-LL-ZZ, deci comparația de text e și comparație de calendar — la fel ca
  // în pagina modulului. Cifrele sunt aceleași pentru toți: transferurile n-au
  // responsabil, deci nici „ale mele” și nici defalcare pe persoane.
  const month = rangeForPeriod("luna");
  const from = toISODate(month.from);
  const to = toISODate(month.to);
  const thisMonth = transfers.filter((t) => t.transfer_date >= from && t.transfer_date <= to);
  const trs = aggregate(thisMonth);

  // Penitenciarul e pentru transferuri ce e responsabilul pentru sarcini: a doua
  // dimensiune firească a cifrelor. Fără ea banda ar arăta doar trei numere.
  const transferInstitutions = byInstitution(thisMonth);

  // Aceeași zi cu cea din care a ieșit luna de mai sus, nu una citită din nou.
  const releases = monthSummary(releasePlans.rows, luna, azi);

  // Defalcarea o vede toată secția, nu doar adminul: cifra „din N” de sub
  // numerele proprii ridică întrebarea unde sunt celelalte, iar tabelul e chiar
  // răspunsul ei. Ascunsă, întrebarea rămânea pusă și fără răspuns.
  //
  // Primește toate elementele, nu doar cele active: altfel coloanele „Total” și
  // „Finalizate” n-ar avea ce număra.
  const taskBreakdown = toBreakdown(tasks, profiles, TASK_COLUMNS, taskStats);
  const petitionBreakdown = toBreakdown(
    petitions,
    profiles,
    PETITION_COLUMNS,
    petitionStats,
  );

  return (
    <>
      {/* Mai lat decât înainte: cardurile duc acum și defalcarea pe coloane. */}
      <main className="mx-auto max-w-6xl p-4 xl:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {profile?.full_name ? `Bun venit, ${profile.full_name}` : "Acasă"}
          </h1>
          {/* Calculatoarele penale au plecat de aici în meniul „Unelte" din
              bara de sus: la ele se ajunge acum din orice modul, nu doar de
              acasă — iar cine socotește un termen o face de obicei în mijlocul
              unei petiții, nu înainte de a o deschide.

              Raportul rămâne, fiindcă nu e de același soi: nu se socotește
              nimic cu el, e hârtia unei singure dimineți, legată de pagina asta
              și de săptămâna ei. Nici tab în antet nu se face — un tab în plus
              lângă celelalte l-ar da drept încă un registru. Discret, deci, dar
              lângă salut: mai jos de titlu nu l-ar găsi nimeni fără să i se
              spună. */}
          <Button asChild variant="outline" size="sm">
            <Link href="/raport-saptamanal">
              <FileText className="mr-2 h-4 w-4" />
              Raportul de marți
            </Link>
          </Button>
        </div>

        {/* Deasupra benzii de termene: căutarea e ce faci cu intenție, banda e
            ce ți se spune. Prima trebuie să fie sub mână de cum se deschide
            pagina; a doua doar să fie văzută. */}
        <GlobalSearch />

        {/* Deasupra cardurilor, fiindcă un termen depășit către ANP nu se
            citește după cifre. Nu apare când n-are ce spune. */}
        <ObligationBand
          items={obligations.obligations.map((o) =>
            // Fără al treilea argument: implicit e ziua Chișinăului, nu ceasul
            // serverului. Un `new Date()` scris aici ar ocoli-o tăcut.
            pendingFor(o, obligations.completed.get(o.id) ?? new Set()),
          )}
        />
        {/* Deasupra cardurilor, lângă obligații, fiindcă e același fel de lucru:
            muncă datată, care se strică dacă trece ziua. Cererea a fost chiar
            „la loc vizibil" — o eliberare uitată nu se repară a doua zi.
            Spre deosebire de banda obligațiilor, chenarul rămâne pe pagină și
            când n-are rânduri: acolo tăcerea înseamnă „nimic urgent", aici ar
            însemna „modulul a dispărut", iar luna goală e ea însăși o veste.
            Se listează doar ce a rămas. Rândurile bifate se numără sus și atât:
            despre ele nu mai e nimic de făcut, iar întinse pe chenar ar împinge
            cardurile afară din primul ecran tocmai către sfârșitul lunii, când
            sunt cele mai multe. Lista întreagă e la /eliberari. */}
        <ReleaseBand
          summary={releases}
          month={luna}
          responsible={responsibleLabel(profiles)}
          available={releasePlans.available}
        />
        {/* Două carduri sus, egale. Al treilea modul ia rândul întreg dedesubt:
            trei nu se împart la două coloane, iar transferurile n-au defalcare
            pe persoane, deci într-o jumătate ar rămâne pe jumătate goale. */}
        <div className="grid gap-4 md:grid-cols-2">
          <ModuleCard
            href="/sarcini"
            title="Sarcini"
            description={
              isAdmin
                ? "Evidența sarcinilor echipei, cu termene și responsabili."
                : "Sarcinile atribuite ție, cu termene și priorități."
            }
            stats={toStats(TASK_COLUMNS, ts, tsAll)}
            breakdown={taskBreakdown}
          />
          <ModuleCard
            href="/petitii"
            title="Petiții"
            description={
              isAdmin
                ? "Registrul petițiilor, cu termene de răspuns."
                : "Petițiile atribuite ție, cu termene de răspuns."
            }
            stats={toStats(PETITION_COLUMNS, ps, psAll)}
            breakdown={petitionBreakdown}
          />
        </div>
        <TransferBand
          totals={trs}
          institutions={transferInstitutions}
          nextTransfer={formatDateRo(nextScheduled(todayInChisinau()))}
        />
        <ChangelogSection />
      </main>
    </>
  );
}
