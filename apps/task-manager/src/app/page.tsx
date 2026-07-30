import {
  getTasks,
  getPetitions,
  getProfiles,
  getCurrentProfile,
  getNotifications,
  getUnreadCount,
  getTransfers,
} from "@/lib/queries";
import {
  taskStats,
  petitionStats,
  groupByAssignee,
  type TaskStats,
  type PetitionStats,
} from "@/lib/hub-stats";
import {
  aggregate,
  byInstitution,
  institutionLabel,
  nextScheduled,
  type TransferTotals,
} from "@/lib/transfers";
import { formatDateRo, rangeForPeriod, toISODate } from "@/lib/periods";
import { AppHeader } from "@/components/layout/app-header";
import { ModuleCard, type ModuleCardStat } from "@/components/hub/module-card";
import { ChangelogSection } from "@/components/hub/changelog-section";
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

/**
 * Fără `tone`: la sarcini și petiții roșul înseamnă „ai o problemă”, iar la
 * transferuri plecările sunt doar o direcție, nu o alarmă. Pe pagina modulului
 * direcția se vede din săgeți, canal pe care cardul nu-l are.
 */
const TRANSFER_COLUMNS: Column<TransferTotals>[] = [
  { label: "Plecați", get: (s) => s.plecati },
  { label: "Sosiți", get: (s) => s.sositi },
  { label: "Sold", title: "Sosiți minus plecați", get: (s) => s.sold },
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
  const [tasks, petitions, profiles, profile, notifications, unread, transfers] =
    await Promise.all([
      getTasks(),
      getPetitions(),
      getProfiles(),
      getCurrentProfile(),
      getNotifications(),
      getUnreadCount(),
      getTransfers(),
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
  // dimensiune firească a cifrelor. Fără ea cardul n-ar avea ce pune sub
  // totaluri, fiindcă modulul n-are responsabil.
  const transferBreakdown = byInstitution(thisMonth).map((r) => ({
    id: String(r.institution),
    name: institutionLabel(r.institution),
    values: [r.plecati, r.sositi],
  }));

  // Defalcarea (doar admin) primește toate elementele, nu doar cele active:
  // altfel coloanele „Total” și „Finalizate” n-ar avea ce număra.
  const taskBreakdown = isAdmin
    ? toBreakdown(tasks, profiles, TASK_COLUMNS, taskStats)
    : undefined;
  const petitionBreakdown = isAdmin
    ? toBreakdown(petitions, profiles, PETITION_COLUMNS, petitionStats)
    : undefined;

  return (
    <>
      <AppHeader profile={profile} notifications={notifications} unread={unread} />
      {/* Mai lat decât înainte: cardurile duc acum și defalcarea pe coloane. */}
      <main className="mx-auto max-w-6xl p-4 xl:px-10">
        <h1 className="mb-6 text-2xl font-semibold">
          {profile?.full_name ? `Bun venit, ${profile.full_name}` : "Acasă"}
        </h1>
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
          {/* O lună fără niciun rând dă 0 / 0 / 0. Cele trei cifre se citesc
              împreună, deci spun „nimic luna asta”; pe pagina modulului soldul
              stă singur sub o perioadă aleasă de om, de aceea acolo e „—”. */}
          <ModuleCard
            href="/transferuri"
            title="Transferuri"
            description="Transferurile deținuților între penitenciare, în luna curentă."
            stats={toStats(TRANSFER_COLUMNS, trs, null)}
            footnote={`Următorul transfer programat: ${formatDateRo(nextScheduled(new Date()))}`}
            breakdown={transferBreakdown}
            breakdownHeader="Penitenciar"
            breakdownAvatars={false}
          />
          <ChangelogSection />
        </div>
      </main>
    </>
  );
}
