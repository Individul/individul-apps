import { Suspense } from "react";

import { getCurrentProfile, getNotifications, getUnreadCount } from "@/lib/queries";
import { getHearing, getHearings } from "@/lib/queries";
import { AppHeader } from "@/components/layout/app-header";
import { DailyForm } from "@/components/hearings/daily-form";
import { PeriodReport } from "@/components/hearings/period-report";
import {
  PERIODS,
  formatDateRo,
  rangeForPeriod,
  toISODate,
  type Period,
} from "@/lib/hearings";

export const dynamic = "force-dynamic";

function readPeriod(value: string | undefined): Period {
  return PERIODS.some((p) => p.value === value) ? (value as Period) : "luna";
}

export default async function SedintePage({
  searchParams,
}: {
  searchParams: { perioada?: string; zi?: string };
}) {
  const period = readPeriod(searchParams.perioada);
  // Ziua se ia din adresă, ca un raport să poată fi trimis prin link.
  const day = searchParams.zi ?? toISODate(new Date());
  const range = rangeForPeriod(period, new Date());

  const [profile, notifications, unread, hearing, hearings] = await Promise.all([
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
    getHearing(day),
    getHearings(toISODate(range.from), toISODate(range.to)),
  ]);

  return (
    <>
      <AppHeader profile={profile} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-5xl space-y-8 p-4 xl:px-10">
        <div>
          <h1 className="text-2xl font-semibold">Ședințe de judecată</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidența zilnică, cumulată pe toate judecătoriile.
          </p>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Introducere — {formatDateRo(day)}</h2>
            <form className="flex items-center gap-2">
              <input type="hidden" name="perioada" value={period} />
              <label htmlFor="zi" className="text-[13px] text-muted-foreground">
                Alege ziua
              </label>
              <input
                id="zi"
                name="zi"
                type="date"
                defaultValue={day}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
              <button
                type="submit"
                className="h-9 rounded-md border border-input px-3 text-sm transition-colors hover:bg-accent"
              >
                Deschide
              </button>
            </form>
          </div>
          <DailyForm date={day} hearing={hearing} />
        </section>

        <section className="space-y-4 border-t pt-6">
          <h2 className="text-sm font-medium">Raport</h2>
          <Suspense fallback={null}>
            <PeriodReport period={period} range={range} hearings={hearings} />
          </Suspense>
        </section>
      </main>
    </>
  );
}
