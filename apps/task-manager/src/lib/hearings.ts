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

/** Cifrele introduse manual pentru o zi; totalurile se deduc din ele. */
export interface HearingCounts {
  tc_petrecute: number;
  tc_amanate: number;
  ij_petrecute: number;
  ij_amanate: number;
}

export interface Hearing extends HearingCounts {
  id: string;
  session_date: string;
  tc_total: number;
  ij_total: number;
  total_general: number;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

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

/**
 * Toți indicatorii, din cele patru cifre introduse.
 *
 *   total pe categorie = petrecute + amânate
 *   total general      = teleconferință + instanță
 */
export interface Indicators extends HearingCounts {
  tc_total: number;
  ij_total: number;
  total: number;
  petrecute: number;
  amanate: number;
}

export function computeIndicators(c: HearingCounts): Indicators {
  const tc_total = c.tc_petrecute + c.tc_amanate;
  const ij_total = c.ij_petrecute + c.ij_amanate;
  return {
    ...c,
    tc_total,
    ij_total,
    total: tc_total + ij_total,
    petrecute: c.tc_petrecute + c.ij_petrecute,
    amanate: c.tc_amanate + c.ij_amanate,
  };
}

const EMPTY: HearingCounts = {
  tc_petrecute: 0,
  tc_amanate: 0,
  ij_petrecute: 0,
  ij_amanate: 0,
};

/** Adună zilele câmp cu câmp, apoi deduce indicatorii din suma lor. */
export function aggregate(rows: HearingCounts[]): Indicators {
  return computeIndicators(
    rows.reduce<HearingCounts>(
      (acc, r) => ({
        tc_petrecute: acc.tc_petrecute + (r.tc_petrecute || 0),
        tc_amanate: acc.tc_amanate + (r.tc_amanate || 0),
        ij_petrecute: acc.ij_petrecute + (r.ij_petrecute || 0),
        ij_amanate: acc.ij_amanate + (r.ij_amanate || 0),
      }),
      { ...EMPTY },
    ),
  );
}
