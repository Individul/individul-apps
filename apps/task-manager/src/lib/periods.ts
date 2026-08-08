import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
} from "date-fns";
import { ro } from "date-fns/locale";

export type Period = "zi" | "saptamana" | "luna" | "trimestru" | "semestru" | "an";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "zi", label: "Zi" },
  { value: "saptamana", label: "Săptămână" },
  { value: "luna", label: "Lună" },
  { value: "trimestru", label: "Trimestru" },
  { value: "semestru", label: "Semestru" },
  { value: "an", label: "An" },
];

export interface DateRange {
  from: Date;
  to: Date;
}

/** Intervalul acoperit de o perioadă, raportat la ziua `ref`. */
export function rangeForPeriod(period: Period, ref: Date = new Date()): DateRange {
  switch (period) {
    case "zi":
      return { from: startOfDay(ref), to: endOfDay(ref) };
    case "saptamana":
      // Săptămâna începe luni, ca în uzul de aici — nu duminică.
      return {
        from: startOfWeek(ref, { weekStartsOn: 1 }),
        to: endOfWeek(ref, { weekStartsOn: 1 }),
      };
    case "luna":
      return { from: startOfMonth(ref), to: endOfMonth(ref) };
    case "trimestru":
      return { from: startOfQuarter(ref), to: endOfQuarter(ref) };
    case "semestru": {
      const y = ref.getFullYear();
      return ref.getMonth() < 6
        ? { from: new Date(y, 0, 1), to: endOfMonth(new Date(y, 5, 1)) }
        : { from: new Date(y, 6, 1), to: endOfMonth(new Date(y, 11, 1)) };
    }
    case "an":
      return { from: startOfYear(ref), to: endOfYear(ref) };
  }
}

/** AAAA-LL-ZZ în ora locală — `toISOString` ar putea muta ziua. */
export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Citește AAAA-LL-ZZ ca dată locală; ora 12 ocolește marginile de fus orar. */
export function parseISODate(s: string): Date {
  return new Date(`${s}T12:00:00`);
}

/** Singurul fus în care lucrează instituția; ceasul serverului nu contează. */
export const FUS = "Europe/Chisinau";

/**
 * Ziua de azi așa cum o vede Chișinăul, ca `Date` la miezul nopții local.
 *
 * `new Date()` pe server e un instant citit pe ceasul mașinii, iar pe Vercel
 * mașina merge pe UTC. Chișinăul e înaintea lui cu două ore iarna și cu trei
 * vara, deci în intervalul dintre miezul nopții de aici și cel de la Greenwich
 * `startOfDay(new Date())` întoarce încă ziua de ieri. Pentru un ceas afișat
 * diferența e cosmetică; pentru o zi calendaristică din care se scoate o
 * săptămână de raport, nu e: cine deschide raportul marți la ora 2 dimineața
 * ar primi cifrele săptămânii dinainte, sub un subsol datat cu ziua de azi.
 *
 * Decalajul nu se adună de mână — Moldova ține ora de vară, deci ar trebui
 * știute și datele la care se schimbă. `Intl` le știe; se citesc de la el
 * anul, luna și ziua, iar din ele se reconstruiește o dată locală. De acolo
 * încolo aritmetica pe zile (`startOfDay`, `addDays`, `getDay`) lucrează pe
 * ziua corectă oricare ar fi fusul mașinii.
 *
 * Instantul se primește ca argument tocmai ca o pagină să-l poată citi o
 * singură dată și să-l folosească peste tot — și ca testele să-l poată fixa.
 */
export function todayInChisinau(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const camp = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return new Date(camp("year"), camp("month") - 1, camp("day"));
}

export function formatDateRo(d: Date | string): string {
  return format(typeof d === "string" ? parseISODate(d) : d, "d MMMM yyyy", { locale: ro });
}

export function rangeLabelRo(range: DateRange): string {
  return `${formatDateRo(range.from)} – ${formatDateRo(range.to)}`;
}
