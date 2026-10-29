import Link from "next/link";

import { getCurrentProfile, getTransferPlans } from "@/lib/queries";
import { PlanList } from "@/components/transfers/plan-list";
import { Pagina } from "@/components/layout/pagina";

export const dynamic = "force-dynamic";

export default async function PlanificarePage() {
  const [plans, profile] = await Promise.all([
    getTransferPlans(),
    getCurrentProfile(),
  ]);

  return (
    <Pagina latime="ingusta" className="space-y-6 print:max-w-none print:space-y-0" cadru="print:max-w-none print:p-0">
      {/* Titlul paginii nu se tipărește: lista tipărită are antetul ei (PlanPrint). */}
      <div className="print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Planificarea transferurilor</h1>
          <Link
            href="/transferuri"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Registrul cifrelor
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Persoanele cu ședințe programate, grupate pe ziua de transfer. Ziua se recalculează
          singură dacă ședința se amână.
        </p>
      </div>

      <PlanList plans={plans} isAdmin={profile?.role === "admin"} />
    </Pagina>
  );
}
