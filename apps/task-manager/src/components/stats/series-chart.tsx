"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listSeries, type SeriesPeriod } from "@/app/statistici/actions";
import { SERIES_LABEL } from "@/lib/stats/labels";
import type { StatSeries } from "@/lib/stats/types";
import { cn } from "@/lib/utils";

/**
 * Paleta categorică: opt sloturi în ordine fixă, definite în `globals.css`.
 * Ordinea e mecanismul de siguranță pentru daltonism, nu o alegere estetică —
 * nuanțele se atribuie pe rând și nu se reciclează niciodată. De aceea graficul
 * are un plafon de opt indicatori simultan: al nouălea ar primi o culoare deja
 * folosită și cele două serii ar deveni imposibil de deosebit.
 */
const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

const MAX_SERIES = SERIES_COLORS.length;

/** Culoarea suprafeței pe care stă graficul — inelul din jurul punctelor. */
const SURFACE = "hsl(var(--card))";
const INK_MUTED = "hsl(var(--muted-foreground))";
const HAIRLINE = "hsl(var(--border))";

/** Peste atâtea perioade punctele se string între ele; rămâne doar cel activ. */
const DOTS_UP_TO = 24;

const NUMBER_FORMAT = new Intl.NumberFormat("ro-RO");

function formatValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : NUMBER_FORMAT.format(value);
}

/** Un indicator e identificat de pereche: același nume poate avea ambele serii. */
function keyOf(indicator: string, series: StatSeries): string {
  return `${series}::${indicator}`;
}

interface Indicator {
  key: string;
  indicator: string;
  series: StatSeries;
}

/** Reuniunea indicatorilor din toate perioadele, în ordinea primei apariții. */
function collectIndicators(periods: SeriesPeriod[]): Indicator[] {
  const seen = new Map<string, Indicator>();
  for (const period of periods) {
    for (const value of period.values) {
      const key = keyOf(value.indicator, value.series);
      if (!seen.has(key)) {
        seen.set(key, { key, indicator: value.indicator, series: value.series });
      }
    }
  }
  return [...seen.values()];
}

/** Un rând de grafic/tabel: perioada plus valoarea fiecărui indicator ales. */
interface Row {
  period: string;
  values: Record<string, number | null>;
}

/**
 * Valorile lipsă rămân lipsă. Un indicator absent dintr-o perioadă nu primește
 * `0` — ar fi o cifră inventată; primește `null`, iar linia se întrerupe acolo.
 */
function buildRows(periods: SeriesPeriod[]): Row[] {
  return periods.map((period) => {
    const values: Record<string, number | null> = {};
    for (const value of period.values) {
      values[keyOf(value.indicator, value.series)] = value.value;
    }
    return { period: period.periodDate, values };
  });
}

interface ChartPoint {
  period: string;
  [key: string]: string | number | null;
}

interface SeriesChartProps {
  kinds: { kind: string; label: string }[];
}

export function SeriesChart({ kinds }: SeriesChartProps) {
  const [kind, setKind] = useState(() => kinds[0]?.kind ?? "");
  const [periods, setPeriods] = useState<SeriesPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  /**
   * Slotul de culoare al fiecărui indicator ales. Culoarea urmează indicatorul,
   * nu poziția lui în listă: dacă se scoate primul indicator, ceilalți își
   * păstrează culoarea învățată de cititor.
   */
  const [slots, setSlots] = useState<Record<string, number>>({});
  // Ultima cerere pornită; una mai veche care se întoarce târziu nu mai scrie.
  const request = useRef(0);

  const load = useCallback(async (next: string) => {
    const token = ++request.current;
    setLoading(true);
    try {
      const rows = await listSeries(next);
      if (request.current !== token) return;
      setPeriods(rows);
      // Un prim indicator ales din start, ca secțiunea să nu arate goală.
      const first = collectIndicators(rows)[0];
      setSlots(first ? { [first.key]: 0 } : {});
    } catch {
      if (request.current !== token) return;
      setPeriods([]);
      setSlots({});
    } finally {
      if (request.current === token) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!kind) return;
    void load(kind);
  }, [kind, load]);

  const indicators = useMemo(() => collectIndicators(periods), [periods]);
  const rows = useMemo(() => buildRows(periods), [periods]);

  /** Seriile desenate, în ordinea sloturilor — legenda nu sare la fiecare click. */
  const series = useMemo(
    () =>
      indicators
        .filter((i) => i.key in slots)
        .map((i) => ({ ...i, slot: slots[i.key], color: SERIES_COLORS[slots[i.key]] }))
        .sort((a, b) => a.slot - b.slot),
    [indicators, slots],
  );

  const full = Object.keys(slots).length >= MAX_SERIES;

  const toggle = (key: string) => {
    setSlots((prev) => {
      if (key in prev) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      const used = new Set(Object.values(prev));
      for (let slot = 0; slot < MAX_SERIES; slot++) {
        if (!used.has(slot)) return { ...prev, [key]: slot };
      }
      return prev; // toate sloturile ocupate
    });
  };

  const points: ChartPoint[] = useMemo(
    () =>
      rows.map((row) => {
        const point: ChartPoint = { period: row.period };
        for (const s of series) point[s.key] = row.values[s.key] ?? null;
        return point;
      }),
    [rows, series],
  );

  const enoughPeriods = rows.length >= 2;

  if (kinds.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-4 py-12 text-center text-muted-foreground">
        Niciun raport importat.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filtrul stă pe un rând, deasupra a tot ce cuprinde. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-9 w-full sm:w-80">
            <SelectValue placeholder="Alege un tip de raport" />
          </SelectTrigger>
          <SelectContent>
            {kinds.map((k) => (
              <SelectItem key={k.kind} value={k.kind}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading && <span className="text-[13px] text-muted-foreground">Se încarcă…</span>}
      </div>

      {/* La reîncărcare ținem randarea anterioară estompată — fără salt de layout. */}
      <div className={cn("grid gap-3 lg:grid-cols-[20rem_1fr]", loading && "opacity-60")}>
        {/* Indicatorii */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/30 px-3.5 py-2 text-[11px] font-medium text-muted-foreground">
            Indicatori
          </div>
          {indicators.length ? (
            <>
              <div className="max-h-[26rem] divide-y overflow-y-auto">
                {indicators.map((i) => {
                  const slot = slots[i.key];
                  const checked = i.key in slots;
                  return (
                    <label
                      key={i.key}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 px-3.5 py-2 transition-colors hover:bg-muted/50",
                        !checked && full && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
                        checked={checked}
                        disabled={!checked && full}
                        onChange={() => toggle(i.key)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-snug">{i.indicator}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {SERIES_LABEL[i.series]}
                        </span>
                      </span>
                      {checked && (
                        <span
                          aria-hidden
                          className="mt-1.5 h-0.5 w-4 shrink-0 rounded-full"
                          style={{ backgroundColor: SERIES_COLORS[slot] }}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              {full && (
                <p className="border-t px-3.5 py-2 text-[11px] text-muted-foreground">
                  Cel mult {MAX_SERIES} indicatori odată — culorile nu se repetă.
                </p>
              )}
            </>
          ) : (
            <p className="px-3.5 py-10 text-center text-[13px] text-muted-foreground">
              {loading ? "Se încarcă…" : "Niciun raport importat pentru acest tip."}
            </p>
          )}
        </div>

        {/* Graficul */}
        <div className="min-w-0 space-y-3">
          <div className="rounded-xl border bg-card p-4">
            {series.length === 0 ? (
              <p className="py-16 text-center text-[13px] text-muted-foreground">
                Alege cel puțin un indicator.
              </p>
            ) : !enoughPeriods ? (
              <p className="py-16 text-center text-[13px] text-muted-foreground">
                Un grafic are nevoie de cel puțin două perioade. Deocamdată există{" "}
                {rows.length === 1 ? "una singură" : "niciuna"} — cifrele sunt în tabelul de mai
                jos.
              </p>
            ) : (
              <>
                {/* Legenda: pentru două sau mai multe serii, mereu prezentă. */}
                {series.length > 1 && (
                  <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {series.map((s) => (
                      <li key={s.key} className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="h-0.5 w-4 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {s.indicator} ({SERIES_LABEL[s.series]})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={HAIRLINE} strokeWidth={1} />
                    <XAxis
                      dataKey="period"
                      tickFormatter={(v: string) => format(parseISO(v), "d MMM yy")}
                      tick={{ fill: INK_MUTED, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: HAIRLINE }}
                      minTickGap={16}
                    />
                    <YAxis
                      tickFormatter={(v: number) => NUMBER_FORMAT.format(v)}
                      tick={{ fill: INK_MUTED, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                    />
                    <Tooltip
                      cursor={{ stroke: HAIRLINE, strokeWidth: 1 }}
                      content={(props) => (
                        <ChartTooltip
                          active={props.active}
                          label={props.label}
                          rows={rows}
                          series={series}
                        />
                      )}
                    />
                    {series.map((s) => (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={`${s.indicator} (${SERIES_LABEL[s.series]})`}
                        stroke={s.color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        // Valorile lipsă rămân goluri: linia nu sare peste ele.
                        connectNulls={false}
                        dot={
                          points.length <= DOTS_UP_TO
                            ? { r: 4, fill: s.color, stroke: SURFACE, strokeWidth: 2 }
                            : false
                        }
                        activeDot={{ r: 5, fill: s.color, stroke: SURFACE, strokeWidth: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {/* Aceleași cifre, citibile fără mouse. */}
          {series.length > 0 && rows.length > 0 && (
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-muted/30 text-[11px] font-medium text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
                        Perioada
                      </th>
                      {series.map((s) => (
                        <th key={s.key} className="px-3 py-2 text-right font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden
                              className="h-0.5 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.indicator} ({SERIES_LABEL[s.series]})
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => (
                      <tr key={row.period}>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          {format(parseISO(row.period), "d MMM yyyy")}
                        </td>
                        {series.map((s) => (
                          <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                            {formatValue(row.values[s.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  rows: Row[];
  series: { key: string; indicator: string; series: StatSeries; color: string }[];
}

/**
 * Citirea la hover: toate seriile din perioada respectivă, nu doar cea nimerită
 * cu mouse-ul. Valoarea conduce, numele o urmează; identitatea vine de la
 * cheia colorată de lângă text, nu de la textul colorat.
 */
function ChartTooltip({ active, label, rows, series }: ChartTooltipProps) {
  if (!active || label === undefined) return null;
  const period = String(label);
  const row = rows.find((r) => r.period === period);
  if (!row) return null;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <div className="mb-1.5 text-[11px] text-muted-foreground">
        {format(parseISO(period), "d MMM yyyy")}
      </div>
      <ul className="space-y-1">
        {series.map((s) => (
          <li key={s.key} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="h-0.5 w-3 shrink-0 self-center rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[13px] font-medium tabular-nums text-foreground">
              {formatValue(row.values[s.key])}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {s.indicator} ({SERIES_LABEL[s.series]})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
