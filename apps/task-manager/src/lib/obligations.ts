import {
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  getDate,
  getDay,
  lastDayOfMonth,
  startOfDay,
  startOfMonth,
  subMonths,
  subWeeks,
} from "date-fns";

import { toISODate } from "./periods";

export type ObligationKind = "lunar_zi" | "lunar_ultima_zi" | "saptamanal";

export interface Obligation {
  id: string;
  title: string;
  recipient: string;
  kind: ObligationKind;
  /** Pentru `lunar_zi`: ziua din lună (1–31). */
  day_of_month: number | null;
  /** Pentru `saptamanal`: 0 = duminică … 5 = vineri … 6 = sâmbătă. */
  weekday: number | null;
  assignee_id: string | null;
  active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * Termenul dintr-o lună anume.
 *
 * Ziua se retează la lungimea lunii: „până la data de 30" în februarie e ultima
 * zi a lui februarie, nu o dată inexistentă. Fără retezare, `new Date(2026, 1,
 * 30)` ar aluneca în martie — adică termenul s-ar muta liniștit cu două zile
 * după lună, exact în luna în care e cel mai strâns.
 */
function monthlyDue(o: Obligation, month: Date): Date {
  const last = lastDayOfMonth(month);
  if (o.kind === "lunar_ultima_zi") return last;
  const wanted = o.day_of_month ?? 1;
  return new Date(month.getFullYear(), month.getMonth(), Math.min(wanted, getDate(last)));
}

/** Ziua din săptămâna lui `ref` care corespunde zilei cerute. */
function weeklyDue(o: Obligation, ref: Date): Date {
  const wanted = o.weekday ?? 5;
  const d = startOfDay(ref);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((wanted - getDay(d) + 7) % 7));
}

/** Cel mai recent termen care a venit deja (azi inclusiv). */
export function lastDue(o: Obligation, today: Date = new Date()): Date {
  const t = startOfDay(today);
  if (o.kind === "saptamanal") {
    const thisWeek = weeklyDue(o, subWeeks(t, 1));
    const candidates = [thisWeek, addWeeks(thisWeek, 1), addWeeks(thisWeek, 2)];
    return candidates.filter((d) => d <= t).at(-1)!;
  }
  const thisMonth = monthlyDue(o, startOfMonth(t));
  return thisMonth <= t ? thisMonth : monthlyDue(o, subMonths(startOfMonth(t), 1));
}

/** Primul termen care n-a venit încă. */
export function nextDue(o: Obligation, today: Date = new Date()): Date {
  const t = startOfDay(today);
  if (o.kind === "saptamanal") {
    const d = weeklyDue(o, t);
    return d > t ? d : addWeeks(d, 1);
  }
  const thisMonth = monthlyDue(o, startOfMonth(t));
  return thisMonth > t ? thisMonth : monthlyDue(o, addMonths(startOfMonth(t), 1));
}

export interface Pending {
  obligation: Obligation;
  /** Termenul care contează acum (AAAA-LL-ZZ). */
  due: string;
  /** Zile până la termen; negativ înseamnă că a trecut. */
  days: number;
  overdue: boolean;
}

/**
 * Termenul care contează acum pentru o obligație.
 *
 * Dacă cel mai recent termen trecut n-a fost bifat, el rămâne cel care contează
 * — restanța nu dispare pentru că a venit luna următoare. Altfel se trece la
 * următorul.
 *
 * Se privește în urmă o singură apariție. O dare de seamă nebifată acum șase
 * luni nu mai e o acțiune de făcut, ci un gol în evidență; ținută la vedere, ar
 * împinge afară exact termenul de săptămâna asta.
 */
export function pendingFor(
  o: Obligation,
  completed: Set<string>,
  today: Date = new Date(),
): Pending {
  const last = lastDue(o, today);
  const due = completed.has(toISODate(last)) ? nextDue(o, today) : last;
  const days = differenceInCalendarDays(due, startOfDay(today));
  return { obligation: o, due: toISODate(due), days, overdue: days < 0 };
}

/**
 * Cu cât timp înainte începe să fie arătată o obligație.
 *
 * Diferă după ritm dintr-un motiv practic: cu cinci zile de preaviz, o obligație
 * săptămânală ar fi vizibilă în fiecare zi lucrătoare, iar o bandă care stă
 * mereu pe ecran devine tapet — se citește la fel de puțin ca nimic.
 */
export function leadDays(kind: ObligationKind): number {
  return kind === "saptamanal" ? 2 : 5;
}

/** Se arată la vedere doar ce e restant sau aproape de termen. */
export function needsAttention(p: Pending): boolean {
  return p.overdue || p.days <= leadDays(p.obligation.kind);
}

/** Restanțele primele, apoi după termen; la egalitate, ordinea din listă. */
export function sortPending(items: Pending[]): Pending[] {
  return [...items].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      a.due.localeCompare(b.due) ||
      a.obligation.position - b.obligation.position,
  );
}
