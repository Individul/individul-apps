import { addMonths, format } from "date-fns";
import { ro } from "date-fns/locale";

import { parseISODate, todayInChisinau, toISODate } from "./periods";
import type { Profile } from "./types";

/*
 * Ziua implicită e cea a Chișinăului, nu a ceasului mașinii.
 *
 * Pe Vercel serverul merge pe UTC, iar Chișinăul e înaintea lui cu două ore
 * iarna și cu trei vara. Între miezul nopții de aici și cel de la Greenwich,
 * `new Date()` întoarce încă ziua de ieri — deci fiecare socoteală de termen ar
 * fi greșită cu o zi în fereastra aceea: banda ar rămâne galbenă în dimineața
 * termenului și portocalie în dimineața de după.
 *
 * Stă în valorile implicite, nu la apeluri: așa e corect și pentru apelurile
 * care se vor scrie de-acum înainte. Cine dă explicit o dată — testele, în
 * primul rând — n-o simte deloc.
 */

export type ReleaseCategory = "condamnati" | "preveniti";

export type ReleaseGround =
  | "termen_executat"
  | "art_91"
  | "art_108"
  | "art_107"
  | "art_95"
  | "art_92"
  | "achitati_csj_ca"
  | "mecanism_compensatoriu"
  | "alte_motive"
  | "incetarea_procesului"
  | "inlocuire_arest"
  | "revocare_arest"
  | "expirare_termen_legal"
  | "expirare_termen_instanta"
  | "achitare"
  | "pedeapsa_neprivativa"
  | "scoatere_urmarire"
  | "amnistiati_preveniti"
  | "arest_contraventional";

/**
 * Temeiurile eliberării — cele nouăsprezece din darea de seamă a ANP
 * (`LIBERATI_MOTIVE`, src/lib/stats/report-views.ts).
 *
 * Etichetele sunt luate de acolo cuvânt cu cuvânt: omul care completează
 * registrul le recunoaște din formularul lunar, iar o reformulare „mai limpede"
 * aici ar rupe tăcut legătura dintre cele două evidențe.
 *
 * Categoria stă lângă etichetă, în același rând, nu într-o a doua listă:
 * grupele meniului se citesc din harta asta, deci nu pot rămâne în urmă.
 *
 * Aceleași nouăsprezece coduri sunt scrise în `check (ground in …)` din
 * migrarea 0027, iar `releases-schema.test.ts` cade dacă cele două se despart.
 */
export const RELEASE_GROUNDS: Record<
  ReleaseGround,
  { label: string; category: ReleaseCategory }
> = {
  termen_executat: { label: "Termen executat", category: "condamnati" },
  art_91: { label: "Art. 91 (condiționat)", category: "condamnati" },
  art_108: { label: "Grațiați (art. 108)", category: "condamnati" },
  art_107: { label: "Amnistiați (art. 107)", category: "condamnati" },
  art_95: { label: "Boală (art. 95)", category: "condamnati" },
  art_92: { label: "Art. 92 (pedeapsă blândă)", category: "condamnati" },
  achitati_csj_ca: { label: "Achitați (CSJ/CA)", category: "condamnati" },
  mecanism_compensatoriu: { label: "Mecanism compensatoriu", category: "condamnati" },
  alte_motive: { label: "Alte motive", category: "condamnati" },
  incetarea_procesului: { label: "Încetarea procesului", category: "preveniti" },
  inlocuire_arest: { label: "Înlocuire arest preventiv", category: "preveniti" },
  revocare_arest: { label: "Revocare arest preventiv", category: "preveniti" },
  expirare_termen_legal: { label: "Expirare termen legal", category: "preveniti" },
  expirare_termen_instanta: { label: "Expirare termen instanță", category: "preveniti" },
  achitare: { label: "Achitare", category: "preveniti" },
  pedeapsa_neprivativa: { label: "Pedeapsă neprivativă", category: "preveniti" },
  scoatere_urmarire: { label: "Scoatere de sub urmărire", category: "preveniti" },
  amnistiati_preveniti: { label: "Amnistiați", category: "preveniti" },
  arest_contraventional: { label: "Arest contravențional", category: "preveniti" },
};

export const CATEGORY_LABEL: Record<ReleaseCategory, string> = {
  condamnati: "Condamnați",
  preveniti: "Preveniți",
};

export function groundLabel(g: ReleaseGround): string {
  return RELEASE_GROUNDS[g].label;
}

/**
 * Temeiurile pregătite pentru meniul derulant, pe cele două grupe.
 *
 * Totul se citește din hărți — și grupele din `CATEGORY_LABEL`, și temeiurile
 * din `RELEASE_GROUNDS`. Perechea „hartă tipizată plus listă scrisă de mână" e
 * capcana descrisă în src/lib/options.ts: compilatorul păzește harta, lista nu,
 * iar temeiul adăugat doar în hartă ar deveni un temei pe care baza îl acceptă
 * și pe care nimeni nu-l poate alege.
 *
 * Ordinea e cea în care sunt scrise cheile, nu alfabetică: temeiurile stau ca
 * în formularul din care sunt luate, ca omul să le caute unde le știe.
 */
export function groupedGroundOptions(): {
  category: ReleaseCategory;
  label: string;
  options: { value: ReleaseGround; label: string }[];
}[] {
  const temeiuri = Object.entries(RELEASE_GROUNDS) as [
    ReleaseGround,
    { label: string; category: ReleaseCategory },
  ][];

  return (Object.keys(CATEGORY_LABEL) as ReleaseCategory[]).map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    options: temeiuri
      .filter(([, t]) => t.category === category)
      .map(([value, t]) => ({ value, label: t.label })),
  }));
}

export interface ReleasePlan {
  id: string;
  last_name: string;
  first_name: string;
  /** Ziua eliberării, AAAA-LL-ZZ. */
  release_date: string;
  ground: ReleaseGround;
  /** S-a eliberat efectiv; fără bifă, o dată trecută nu spune dacă omul a ieșit. */
  done: boolean;
  /** Când a plecat anunțul de dimineață; `null` cât timp n-a plecat. */
  notified_at: string | null;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Numele de familie primul, ca în registru — și ca în anunțul scris de
 * `notify_todays_releases()`, ca ecranul și notificarea să spună la fel.
 */
export function fullName(p: Pick<ReleasePlan, "last_name" | "first_name">): string {
  return `${p.last_name} ${p.first_name}`;
}

export type ReleaseState = "gata" | "restant" | "azi" | "viitor";

/**
 * Starea unui rând.
 *
 * Bifa bate data: un rând bifat e închis oricând ar fi fost programat. Fără
 * asta, o eliberare făcută cu o zi mai devreme ar rămâne „restantă" pentru
 * totdeauna, deși e chiar lucrul dus la capăt.
 *
 * „Azi" e o stare de sine stătătoare, nu o margine a viitorului: ziua
 * eliberării e singura zi în care omul chiar trebuie scos, iar dacă arată la
 * fel ca „peste două săptămâni" trece neobservată exact atunci când nu trebuie.
 *
 * Comparația e pe text, nu pe `Date`: ambele părți sunt AAAA-LL-ZZ, iar la
 * formatul ăsta ordinea alfabetică e ordinea calendaristică. Nimic nu mai trece
 * printr-un fus orar, deci nu există nicio oră din zi în care starea să alunece.
 */
export function releaseState(p: ReleasePlan, today: Date = todayInChisinau()): ReleaseState {
  if (p.done) return "gata";
  const azi = toISODate(today);
  if (p.release_date === azi) return "azi";
  return p.release_date < azi ? "restant" : "viitor";
}

export interface ReleaseRow {
  plan: ReleasePlan;
  state: ReleaseState;
}

export interface MonthSummary {
  total: number;
  done: number;
  remaining: ReleaseRow[];
}

/**
 * Luna: două cifre și o listă scurtă.
 *
 * Se numără tot, dar se listează doar ce a rămas. Într-o lună obișnuită sunt
 * vreo cincisprezece eliberări, iar chenarul de pe pagina de start s-ar întinde
 * cât ecranul dacă ar arăta și rândurile bifate — adică tocmai cele despre care
 * nu mai e nimic de făcut. „x din y" spune cât s-a lucrat, lista spune ce a mai
 * rămas de lucrat; pentru rest există pagina întreagă.
 *
 * Apartenența la lună e un prefix de text: `release_date` e AAAA-LL-ZZ, deci
 * „2026-08" prinde exact zilele lui august. Nicio dată nu trece prin `Date`,
 * deci luna nu se poate muta dintr-un fus orar.
 */
export function monthSummary(
  plans: ReleasePlan[],
  month: string,
  today: Date = todayInChisinau(),
): MonthSummary {
  const dinLuna = plans.filter((p) => p.release_date.startsWith(month));

  const remaining = dinLuna
    .filter((p) => !p.done)
    .map((plan) => ({ plan, state: releaseState(plan, today) }))
    // Cronologic — ceea ce înseamnă chiar restanțele primele: starea se citește
    // din aceeași dată, deci ce a trecut stă înaintea zilei de azi, iar azi
    // înaintea viitorului. Un al doilea criteriu „restanțele sus" n-ar avea ce
    // să schimbe, așa că lipsește.
    .sort((a, b) => a.plan.release_date.localeCompare(b.plan.release_date));

  return {
    total: dinLuna.length,
    done: dinLuna.filter((p) => p.done).length,
    remaining,
  };
}

/**
 * Cui îi pleacă anunțul din ziua eliberării.
 *
 * Bifați dacă e cineva bifat, altfel administratorii. Rezerva nu e o politețe:
 * anunțul e singurul lucru care aduce eliberarea de azi în fața cuiva, iar o
 * bifă uitată pe profil l-ar opri fără eroare și fără urmă — modulul ar părea
 * viu și n-ar mai anunța pe nimeni. Un anunț ajuns la cine nu trebuie se vede
 * și se repară; unul care n-a plecat, nu.
 *
 * Aceeași regulă e scrisă și în `notify_todays_releases()` (migrarea 0027).
 * Două locuri fiindcă sunt două momente: acolo o aplică pg_cron dimineața, aici
 * o citește pagina ca să poată spune dinainte cui va pleca.
 */
export function notificationRecipients(profiles: Profile[]): string[] {
  const responsabili = profiles.filter((p) => p.handles_releases);
  const destinatari = responsabili.length
    ? responsabili
    : profiles.filter((p) => p.role === "admin");
  return destinatari.map((p) => p.id);
}

/**
 * „Responsabil: …" de pe chenar — sau nimic.
 *
 * `null`, nu un text de tipul „nimeni desemnat": eticheta se ascunde cu totul.
 * Un rând care anunță zilnic o lipsă nu duce la nicio faptă, fiindcă bifa se
 * pune din pagina profilurilor, nu de aici.
 *
 * Profilurile fără nume completat sunt sărite: „Responsabil: " urmat de nimic
 * arată a defect al paginii, deși e doar un profil necompletat.
 */
export function responsibleLabel(profiles: Profile[]): string | null {
  const nume = profiles
    .filter((p) => p.handles_releases)
    .map((p) => p.full_name?.trim())
    .filter((n): n is string => Boolean(n));
  return nume.length ? nume.join(", ") : null;
}

/**
 * Luna vecină, tot ca text.
 *
 * Prin `addMonths`, nu cu socoteală pe cifre: decembrie plus unu e ianuarie
 * anul viitor, iar aritmetica scrisă de mână greșește exact la marginea asta —
 * o dată pe an, deci târziu.
 */
export function shiftMonth(month: string, delta: number): string {
  return format(addMonths(parseISODate(`${month}-01`), delta), "yyyy-MM");
}

const LUNA = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Luna cerută prin adresă, adusă la ceva ce există.
 *
 * O adresă stricată nu e o eroare pe care cineva să o poată repara, deci nu
 * merită una: se arată luna curentă, adică lucrul pe care omul îl voia oricum.
 * `readWeek` (src/lib/weekly-report.ts) face la fel, din același motiv.
 *
 * Șablonul verifică luna, nu doar numărul de cifre, iar aici asta ajunge: la
 * săptămâni a mai fost nevoie de o verificare după parsare, fiindcă
 * „2026-02-30" trece de orice șablon de cifre și V8 îl rostogolește liniștit în
 * martie. Lunile imposibile sunt doar 00 și 13-99 — toate încap în șablon.
 */
export function readMonth(value: string | undefined, today: Date = todayInChisinau()): string {
  if (!value || !LUNA.test(value)) return format(today, "yyyy-MM");
  return value;
}

/**
 * „august 2026", pentru titlul lunii afișate.
 *
 * `LLLL` e forma de sine stătătoare a lunii, `MMMM` cea dinăuntrul unei date
 * întregi. În `ro` din date-fns ele dau azi același cuvânt, deci confuzia n-ar
 * strica nimic vizibil — și tocmai de aceea ar trece neobservată până în ziua
 * în care localizarea capătă și forma flexionată, cum au deja alte limbi.
 */
export function monthLabelRo(month: string): string {
  return format(parseISODate(`${month}-01`), "LLLL yyyy", { locale: ro });
}
