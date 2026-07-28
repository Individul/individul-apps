import {
  getTasks,
  getPetitions,
  getCurrentProfile,
  getNotifications,
  getUnreadCount,
} from "@/lib/queries";
import { taskStats, petitionStats } from "@/lib/hub-stats";
import { AppHeader } from "@/components/layout/app-header";
import { ModuleCard } from "@/components/hub/module-card";

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const [tasks, petitions, profile, notifications, unread] = await Promise.all([
    getTasks(),
    getPetitions(),
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
  ]);
  const ts = taskStats(tasks);
  const ps = petitionStats(petitions);

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
            description="Evidența sarcinilor echipei, cu termene și responsabili."
            stats={[
              { label: "Total", value: ts.total },
              { label: "Active", value: ts.active },
              { label: "Scadente 7 zile", value: ts.dueSoon, tone: "warning" },
              { label: "Restante", value: ts.overdue, tone: "danger" },
            ]}
          />
          <ModuleCard
            href="/petitii"
            title="Petiții"
            description="Registrul petițiilor, cu termene de răspuns."
            stats={[
              { label: "Total", value: ps.total },
              { label: "În examinare", value: ps.open },
              { label: "Scadente 7 zile", value: ps.dueSoon, tone: "warning" },
              { label: "Restante", value: ps.overdue, tone: "danger" },
            ]}
          />
        </div>
      </main>
    </>
  );
}
