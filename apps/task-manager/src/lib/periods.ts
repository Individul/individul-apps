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

export function formatDateRo(d: Date | string): string {
  return format(typeof d === "string" ? parseISODate(d) : d, "d MMMM yyyy", { locale: ro });
}

export function rangeLabelRo(range: DateRange): string {
  return `${formatDateRo(range.from)} – ${formatDateRo(range.to)}`;
}
