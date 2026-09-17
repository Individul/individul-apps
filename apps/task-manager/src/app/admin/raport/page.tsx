import { redirect } from "next/navigation";

import { getCurrentProfile, getProfiles, getSarciniRaport, getPetitiiRaport } from "@/lib/queries";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { RaportActivitate } from "@/components/reports/activity-report";
import { construiesteRaport } from "@/lib/raport-activitate";
import {
  PERIODS,
  rangeForPeriod,
  rangeLabelRo,
  readAnchor,
  shiftPeriod,
  todayInChisinau,
  toISODate,
  type Period,
} from "@/lib/periods";

export const dynamic = "force-dynamic";

/**
 * Luna, când adresa nu spune altceva.
 *
 * E perioada cerută cel mai des, iar celelalte cinci se aleg dintr-o apăsare.
 * „Zi” există fiindcă vine cu lista de perioade, dar n-ar fi un implicit
 * potrivit pentru o dare de seamă.
 */
function readPeriod(value: string | undefined): Period {
  return PERIODS.some((p) => p.value === value) ? (value as Period) : "luna";
}

export default async function RaportActivitatePage({
  searchParams,
}: {
  searchParams: { perioada?: string; la?: string | string[] };
}) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") redirect("/");

  const period = readPeriod(searchParams.perioada);
  // Ziua de azi pe ora Republicii Moldova; serverul merge pe UTC și, până la 3
  // dimineața, „luna curentă” ar fi cea trecută. Vezi `todayInChisinau`.
  const azi = todayInChisinau();
  const anchor = readAnchor(searchParams.la, azi);
  const range = rangeForPeriod(period, anchor);
  // „Înainte” se oprește la perioada în care ne aflăm: una care încă n-a venit
  // n-are ce raporta.
  const esteCurenta = range.from <= azi && azi <= range.to;

  const [sarcini, petitii, profiluri] = await Promise.all([
    getSarciniRaport(),
    getPetitiiRaport(),
    getProfiles(),
  ]);
  const raport = construiesteRaport(sarcini, petitii, profiluri, range);

  return (
    <main className="mx-auto max-w-4xl p-6 print:max-w-none print:p-0">
      <ReportToolbar
        basePath="/admin/raport"
        inapoiHref="/admin"
        inapoiEticheta="Administrare"
        period={period}
        eticheta={rangeLabelRo(range)}
        inapoi={toISODate(shiftPeriod(period, anchor, -1))}
        inainte={esteCurenta ? null : toISODate(shiftPeriod(period, anchor, 1))}
      />

      <RaportActivitate
        raport={raport}
        eticheta={rangeLabelRo(range)}
        intocmitDe={me.full_name ?? "—"}
        // Ora Chișinăului, spusă explicit: serverul merge pe UTC, iar un
        // document oficial cu ceasul dat cu 2-3 ore înapoi la fiecare tipărire
        // ridică exact întrebările pe care nu le vrei la dosar.
        intocmitLa={new Intl.DateTimeFormat("ro-RO", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Europe/Chisinau",
        }).format(new Date())}
      />
    </main>
  );
}
