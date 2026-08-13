import Link from "next/link";
import { endOfMonth } from "date-fns";

import { AppHeader } from "@/components/layout/app-header";
import { ReleaseList } from "@/components/releases/release-list";
import { parseISODate, toISODate, todayInChisinau } from "@/lib/periods";
import {
  getCurrentProfile,
  getNotifications,
  getProfiles,
  getReleasePlans,
  getReleases,
  getUnreadCount,
} from "@/lib/queries";
import { monthLabelRo, monthSummary, readMonth, responsibleLabel } from "@/lib/releases";

export const dynamic = "force-dynamic";

export default async function EliberariPage({
  searchParams,
}: {
  // `string[]`, nu doar `string`: un parametru scris de două ori în adresă
  // ajunge la pagină ca listă, iar `readMonth` ia prima valoare — la fel ca
  // `readWeek` la raportul săptămânal.
  searchParams: { luna?: string | string[] };
}) {
  // Ziua se citește o singură dată, și pe calendarul Chișinăului: din ea ies și
  // luna implicită, și starea fiecărui rând. Două citiri ale ceasului s-ar
  // putea nimeri de-o parte și de alta a miezului nopții, iar pagina ar arăta
  // august cu rândurile socotite pentru septembrie.
  const today = todayInChisinau();
  const luna = readMonth(searchParams.luna, today);

  const primaZi = `${luna}-01`;
  // Ultima zi se calculează, nu se scrie „-31": `getReleases` compară cu `lte`,
  // iar Postgres cade cu eroare la „2026-02-31" în loc să întoarcă zero rânduri.
  const ultimaZi = toISODate(endOfMonth(parseISODate(primaZi)));

  const [plans, profile, notifications, unread, profiles, cifre] = await Promise.all([
    getReleasePlans(luna),
    getCurrentProfile(),
    getNotifications(),
    getUnreadCount(),
    getProfiles(),
    getReleases(primaZi, ultimaZi),
  ]);

  const summary = monthSummary(plans.rows, luna, today);
  const responsible = responsibleLabel(profiles);

  // Registrul de cifre ține un rând pe zi, cu numărul zilei în el: comparația
  // se face cu suma lunii, nu cu numărul de rânduri.
  const inCifre = cifre.rows.reduce((n, r) => n + r.count, 0);

  /*
   * Nepotrivirea dintre cele două evidențe se arată, nu se corectează.
   *
   * Una e lista nominală de lucru, cealaltă e cifra raportată conducerii. O
   * cifră scoasă automat din numărul de nume ar face cele două să se
   * potrivească întotdeauna — adică ar ascunde tocmai diferența care merită
   * văzută: un nume în plus înseamnă ori o zi necompletată în registrul de
   * cifre, ori o eliberare care n-a mai avut loc, și numai omul știe care.
   *
   * Se compară `done`, nu `total`. Cele două evidențe măsoară același lucru —
   * oameni care au ieșit pe poartă — abia dacă lista nominală e citită tot
   * așa. `total` numără și pe cei programați pentru săptămâna viitoare, în timp
   * ce cifra se completează în urmă, zi cu zi. Pe 13 august, cu douăsprezece
   * nume din care cinci ieșite, „12 față de 5" ar fi scris cu roșu că nu se
   * potrivește nimic — deși totul e în regulă, și așa ar fi în aproape fiecare
   * zi a fiecărei luni în curs. Pe lunile încheiate `done` e egal cu `total`,
   * deci nu se pierde nimic din ce chiar merită comparat.
   *
   * Linia tace și în trei goluri. Când registrul de cifre n-a răspuns
   * (`available` fals) n-are cu ce compara. Când n-are niciun rând pentru lună,
   * „5 față de 0" ar fi o alarmă falsă în fiecare 1 ale lunii — se cere niciun
   * rând, nu sumă zero: un „0" scris de om înseamnă zi verificată, iar asta e o
   * comparație validă. Și când n-a ieșit încă nimeni, n-avem ce compara.
   */
  const nepotrivire =
    cifre.available && cifre.rows.length > 0 && summary.done > 0 && inCifre !== summary.done;

  return (
    <>
      <AppHeader profile={profile} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-5xl space-y-6 p-4 xl:px-10">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">Eliberări</h1>
            <Link
              href="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Acasă
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cine se eliberează și când — lista nominală, ținută separat de cifra lunară din
            raportul de marți.
            {/* Numele apare doar dacă e cineva bifat: vezi `responsibleLabel`. */}
            {responsible && <> Responsabil: {responsible}.</>}
          </p>
        </div>

        {/* Citirea căzută nu se confundă cu luna goală: „nicio eliberare" e
            tocmai răspunsul pe care omul l-ar crede fără să-l verifice. */}
        {!plans.available && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-[13px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            Registrul n-a putut fi citit — lista de mai jos e goală din cauza asta, nu fiindcă n-ar
            fi nimeni. Reîncarcă pagina.
          </p>
        )}

        <ReleaseList
          plans={plans.rows}
          luna={luna}
          today={toISODate(today)}
          isAdmin={profile?.role === "admin"}
        />

        {nepotrivire && (
          <p className="rounded-lg border bg-muted/30 px-3.5 py-2 text-[13px] text-muted-foreground">
            {summary.total} nume în listă, {inCifre} în registrul de cifre pentru{" "}
            {monthLabelRo(luna)}.
          </p>
        )}
      </main>
    </>
  );
}
