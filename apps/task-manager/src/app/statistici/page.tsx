import {
  getCurrentProfile,
  getNotifications,
  getStatReports,
  getUnreadCount,
} from "@/lib/queries";
import { AppHeader } from "@/components/layout/app-header";
import { ImportDialog } from "@/components/stats/import-dialog";
import { ReportsTable } from "@/components/stats/reports-table";
import { SeriesChart } from "@/components/stats/series-chart";
import { kindLabel } from "@/lib/stats/labels";

export const dynamic = "force-dynamic";

export default async function StatisticiPage() {
  const [reports, currentProfile, notifications, unread] = await Promise.all([
    getStatReports(),
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
  ]);
  const isAdmin = currentProfile?.role === "admin";

  // Doar tipurile care chiar au rapoarte — graficul nu oferă selecții goale.
  const kinds = [...new Set(reports.map((r) => r.kind))].map((kind) => ({
    kind,
    label: kindLabel(kind),
  }));

  return (
    <>
      <AppHeader profile={currentProfile} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-[1800px] p-4 xl:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Statistici</h1>
          {isAdmin && <ImportDialog />}
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Rapoarte importate</h2>
          <ReportsTable reports={reports} isAdmin={isAdmin} />
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Evoluția indicatorilor</h2>
          <SeriesChart kinds={kinds} />
        </section>
      </main>
    </>
  );
}
