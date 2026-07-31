import { startOfDay, startOfMonth, subMonths } from "date-fns";

import { scheduledDays } from "./transfers";
import { toISODate } from "./periods";
import type { Court } from "./courts";

export interface TransferPlan {
  id: string;
  last_name: string;
  first_name: string;
  court: Court;
  /** Penitenciarul unde trebuie dus omul pentru ședință. */
  institution: number;
  hearing_date: string;
  done: boolean;
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
export function transferDayFor(hearing: Date, today: Date = new Date()): string | null {
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
  today: Date = new Date(),
): PlanGroup[] {
  const byDay = new Map<string | null, TransferPlan[]>();

  for (const p of plans) {
    if (p.done) continue;
    const day = transferDayFor(new Date(`${p.hearing_date}T12:00:00`), today);
    const list = byDay.get(day);
    if (list) list.push(p);
    else byDay.set(day, [p]);
  }

  const groups = [...byDay].map(([day, list]) => ({
    day,
    plans: [...list].sort((a, b) => a.hearing_date.localeCompare(b.hearing_date)),
  }));

  return groups.sort((a, b) => {
    if (a.day === null) return -1;
    if (b.day === null) return 1;
    return a.day.localeCompare(b.day);
  });
}
