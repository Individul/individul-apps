import { addDays, startOfDay, startOfMonth, subMonths } from "date-fns";

import { institutionLabel, nextScheduled, scheduledDays } from "./transfers";
import { fold } from "./text";
import { parseISODate, todayInChisinau, toISODate } from "./periods";

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
import type { Court } from "./courts";

/** Ce anume cere transferul. Vezi migrările 0027 și 0034. */
export type TransferBasis = "sedinta" | "decizie" | "termen30";

/** Câte zile are temeiul „30 zile", de la introducerea încheierii. */
export const TERMEN_ZILE = 30;

export interface TransferPlan {
  id: string;
  last_name: string;
  first_name: string;
  basis: TransferBasis;
  /** Lipsește când temeiul e o decizie venită din afara unei judecătorii. */
  court: Court | null;
  /** Penitenciarul unde trebuie dus omul. */
  institution: number;
  /** Completată doar la temei „ședință". */
  hearing_date: string | null;
  /** Data parvenirii deciziei; completată doar la temei „decizie". */
  decision_date: string | null;
  /**
   * Data încheierii, cum e scrisă pe ea; doar la temei „30 zile".
   * Opționale amândouă: până la aplicarea migrării 0034 lipsesc din rânduri.
   */
  ruling_date?: string | null;
  /** Ziua introducerii încheierii — de aici curg cele 30 de zile. O pune aplicația. */
  term_start?: string | null;
  done: boolean;
  /**
   * Când s-a expediat instanței înștiințarea despre imposibilitatea executării.
   * Opționale toate trei: până la aplicarea migrării 0029 lipsesc din rânduri.
   */
  notified_at?: string | null;
  notified_by?: string | null;
  /** Ședința pentru care s-a trimis înștiințarea. Vezi `esteInstiintat`. */
  notified_hearing_date?: string | null;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ziua de transfer pentru o ședință: cea mai apropiată zi programată dinaintea
 * ședinței care încă n-a trecut.
 *
 * „Cea mai apropiată", nu „prima disponibilă": mutat cu șase săptămâni înainte,
 * omul ar aștepta degeaba la altă instituție. Transferul se face în ultimul
 * moment posibil.
 *
 * `null` înseamnă că nu mai există zi de transfer înainte de ședință — cazul în
 * care instanța trebuie înștiințată că nu poate fi pusă în executare.
 */
export function transferDayFor(hearing: Date, today: Date = todayInChisinau()): string | null {
  const h = startOfDay(hearing);
  const from = startOfDay(today);

  // Între a treia luni a unei luni și prima luni a următoarei pot trece ~3
  // săptămâni, deci luna precedentă intră mereu în calcul.
  const month = startOfMonth(h);
  const candidates = [subMonths(month, 1), month].flatMap((m) =>
    scheduledDays(m.getFullYear(), m.getMonth()),
  );

  const usable = candidates.filter((d) => d < h && d >= from);
  return usable.length ? toISODate(usable[usable.length - 1]) : null;
}

/**
 * Ziua de transfer pentru o decizie: prima zi programată de la parvenirea ei.
 *
 * Regula e răsturnată față de ședințe. Acolo transferul se face înaintea unui
 * termen, deci în ultimul moment posibil, și se poate întâmpla să nu mai existe
 * niciun moment. Aici decizia e deja luată: se execută la prima ocazie, iar
 * ocazie există întotdeauna — de aceea nu întoarce niciodată `null`.
 *
 * Se pornește de la ziua mai târzie dintre parvenire și azi. O decizie sosită
 * luna trecută și rămasă neexecutată nu trimite omul la o zi care a trecut: se
 * mută la următoarea, ca și o ședință amânată.
 */
export function transferDayForDecision(
  decision: Date,
  today: Date = todayInChisinau(),
): string {
  const d = startOfDay(decision);
  const t = startOfDay(today);
  return toISODate(nextScheduled(d > t ? d : t));
}

/**
 * Data scrisă pe hârtia care cere transferul, oricare ar fi temeiul: ședința,
 * parvenirea deciziei sau data încheierii. E data care se arată pe rând și după
 * care se ordonează rândurile; ziua transferului se socotește separat.
 */
export function planDate(plan: TransferPlan): string | null {
  if (plan.basis === "decizie") return plan.decision_date;
  if (plan.basis === "termen30") return plan.ruling_date ?? null;
  return plan.hearing_date;
}

/**
 * Ultima zi a termenului de 30 de zile; `null` la celelalte temeiuri.
 *
 * Se numără de la introducerea încheierii (`term_start`), nu de la data scrisă
 * pe ea — așa s-a cerut: termenul curge din momentul în care secția află de
 * încheiere, nu de când a fost semnată în altă parte.
 */
export function termenLimita(plan: TransferPlan): string | null {
  if (plan.basis !== "termen30" || !plan.term_start) return null;
  return ultimaZiDinTermen(plan.term_start);
}

/** Ultima zi a celor 30, pornind de la ziua introducerii (AAAA-LL-ZZ). */
export function ultimaZiDinTermen(termStart: string): string {
  return toISODate(addDays(parseISODate(termStart), TERMEN_ZILE));
}

/**
 * Omul nu mai apucă să plece în termen: prima zi de transfer care i-a rămas
 * cade după ultima zi a celor 30.
 *
 * Fiindcă ziua de transfer se socotește de la azi încolo, întrebarea prinde și
 * cazul în care termenul a trecut deja: atunci orice zi rămasă e după el.
 * Planurile încheiate nu se mai semnalează — omul a plecat.
 */
export function termenDepasit(plan: TransferPlan, today: Date = todayInChisinau()): boolean {
  if (plan.done) return false;
  const limita = termenLimita(plan);
  if (!limita) return false;
  const zi = planTransferDay(plan, today);
  return zi !== null && zi > limita;
}

/**
 * Ziua de transfer a unei planificări, după temeiul ei.
 *
 * `null` înseamnă „de înștiințat instanța" — dar numai la ședințe; la decizii
 * apare doar dacă data lipsește cu totul, ceea ce baza nu îngăduie.
 */
export function planTransferDay(
  plan: TransferPlan,
  today: Date = todayInChisinau(),
): string | null {
  // La „30 zile" ziua se socotește de la introducerea încheierii, nu de la
  // data scrisă pe ea: e aceeași regulă ca la decizie — prima zi programată —
  // pornită din ziua în care secția a aflat.
  if (plan.basis === "termen30") {
    return plan.term_start ? transferDayForDecision(parseISODate(plan.term_start), today) : null;
  }
  const d = planDate(plan);
  if (!d) return null;
  return plan.basis === "decizie"
    ? transferDayForDecision(parseISODate(d), today)
    : transferDayFor(parseISODate(d), today);
}

export interface PlanGroup {
  /** Ziua de transfer; `null` = de înștiințat instanța. */
  day: string | null;
  plans: TransferPlan[];
}

/**
 * Grupează planurile neîncheiate pe ziua de transfer calculată, cronologic.
 * Cele fără zi posibilă ies primele: sunt singurele care cer o acțiune azi.
 */
export function groupByTransferDay(
  plans: TransferPlan[],
  today: Date = todayInChisinau(),
): PlanGroup[] {
  const byDay = new Map<string | null, TransferPlan[]>();

  for (const p of plans) {
    if (p.done) continue;
    const day = planTransferDay(p, today);
    const list = byDay.get(day);
    if (list) list.push(p);
    else byDay.set(day, [p]);
  }

  const groups = [...byDay].map(([day, list]) => ({
    day,
    plans: [...list].sort((a, b) => (planDate(a) ?? "").localeCompare(planDate(b) ?? "")),
  }));

  return groups.sort((a, b) => {
    if (a.day === null) return -1;
    if (b.day === null) return 1;
    return a.day.localeCompare(b.day);
  });
}

/**
 * Are omul înștiințarea deja expediată pentru situația de ACUM?
 *
 * Nu e de ajuns ca `notified_at` să fie completat. Ziua de transfer se
 * calculează din data ședinței, deci o amânare scoate omul din grupul „de
 * înștiințat"; dacă se amână iarăși într-o zi imposibilă, e altă imposibilitate
 * și cere altă hârtie. Bifa veche, lăsată aprinsă, ar spune că instanța a fost
 * înștiințată despre ceva ce nu s-a înștiințat — iar cineva ar afla asta abia
 * când omul n-ar ajunge la ședință.
 *
 * De aceea se compară cu ședința pentru care s-a trimis.
 */
export function esteInstiintat(plan: TransferPlan): boolean {
  if (!plan.notified_at || !plan.notified_hearing_date) return false;
  return plan.notified_hearing_date === plan.hearing_date;
}

/**
 * Se potrivește planul cu ce s-a scris în căutare?
 *
 * Se caută în nume, instanță, penitenciar și observații — ce se vede pe rând,
 * plus observațiile, unde stă adesea tocmai detaliul după care e căutat omul.
 * Fără diacritice și fără majuscule, ca peste tot în aplicație: „Tiganciuc"
 * găsește „Țiganciuc". Penitenciarul se caută după cum e scris pe ecran
 * („Penitenciarul nr. 13"), deci merge și „nr. 13", și „13".
 */
export function matchesPlan(p: TransferPlan, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const text = fold(
    [p.last_name, p.first_name, p.court, institutionLabel(p.institution), p.note]
      .filter(Boolean)
      .join(" "),
  );
  return text.includes(q);
}
