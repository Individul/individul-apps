import {
  getTasks,
  getPetitions,
  getProfiles,
  getCurrentProfile,
  getNotifications,
  getUnreadCount,
} from "@/lib/queries";
import {
  taskStats,
  petitionStats,
  countsByAssignee,
  isTaskOverdue,
  isPetitionOverdue,
} from "@/lib/hub-stats";
import { AppHeader } from "@/components/layout/app-header";
import { ModuleCard } from "@/components/hub/module-card";

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const [tasks, petitions, profiles, profile, notifications, unread] = await Promise.all([
    getTasks(),
    getPetitions(),
    getProfiles(),
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
  ]);

  const isAdmin = profile?.role === "admin";
  const me = profile?.id ?? null;

  // Adminul vede tot; membrul doar ce-i e atribuit.
  const myTasks = isAdmin ? tasks : tasks.filter((t) => t.assignee_id === me);
  const myPetitions = isAdmin ? petitions : petitions.filter((p) => p.assignee_id === me);

  const ts = taskStats(myTasks);
  const ps = petitionStats(myPetitions);

  // Defalcarea (doar admin) se face peste elementele relevante, nu peste arhivă.
  const taskBreakdown = isAdmin
    ? countsByAssignee(
        tasks.filter((t) => t.status !== "done"),
        profiles,
        (t) => isTaskOverdue(t),
      )
    : undefined;
  const petitionBreakdown = isAdmin
    ? countsByAssignee(
        petitions.filter((p) => p.status === "in_examinare"),
        profiles,
        (p) => isPetitionOverdue(p),
      )
    : undefined;

  return (
    <>
      <AppHeader profile={profile} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-5xl p-4 xl:px-10">
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
            stats={[
              { label: "Total", value: ts.total },
              { label: "Active", value: ts.active },
              { label: "Finalizate", value: ts.done },
              { label: "Scadente 7 zile", value: ts.dueSoon, tone: "warning" },
              { label: "Restante", value: ts.overdue, tone: "danger" },
            ]}
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
            stats={[
              { label: "Total", value: ps.total },
              { label: "În examinare", value: ps.open },
              { label: "Soluționate", value: ps.solved },
              { label: "Scadente 7 zile", value: ps.dueSoon, tone: "warning" },
              { label: "Restante", value: ps.overdue, tone: "danger" },
            ]}
            breakdown={petitionBreakdown}
          />
        </div>
      </main>
    </>
  );
}
