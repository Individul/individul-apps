import type { Grid, StatItem, StatKind, StatParser } from "./types";
import { findRowStarting, toNumber } from "./grid";
import { detectScore, labelFromParts } from "./parser-utils";

export interface RowParserConfig {
  kind: StatKind;
  label: string;
  /** Cuvinte-cheie căutate în antet (comparate cu minuscule). */
  keywords: string[];
  /** Prefixul primei celule nevide de pe rândul penitenciarului 6. */
  rowPrefix: string;
  /** Câte rânduri de la începutul grilei formează antetul. */
  headerRows: number;
  /**
   * Rândul imediat următor conține valorile pe perioadă. Eticheta lui diferă
   * de la un penitenciar la altul („Lunar" / „Săptămînal"), deci se ia mereu
   * rândul următor, fără să i se citească textul.
   */
  hasPeriodRow: boolean;
}

/**
 * Rapoarte „pe rânduri": fiecare penitenciar are un rând, indicatorii stau pe
 * coloane și se compun din primele `headerRows` rânduri.
 */
export function rowParser(config: RowParserConfig): StatParser {
  const { kind, label, keywords, rowPrefix, headerRows, hasPeriodRow } = config;

  return {
    kind,
    label,
    detect(grid: Grid): number {
      if (findRowStarting(grid, rowPrefix) === null) return 0;
      return detectScore(grid, keywords, headerRows);
    },
    parse(grid: Grid): StatItem[] {
      const penRow = findRowStarting(grid, rowPrefix);
      if (penRow === null) {
        throw new Error(`Nu am găsit rândul „${rowPrefix.trim()}” în fișier.`);
      }

      const header = grid.slice(0, headerRows).map((row) => row ?? []);
      const values = grid[penRow] ?? [];
      const period = hasPeriodRow ? grid[penRow + 1] ?? [] : [];
      const width = Math.max(
        values.length,
        period.length,
        ...header.map((row) => row.length),
      );

      const items: StatItem[] = [];
      for (let c = 0; c < width; c++) {
        const indicator = labelFromParts(header.map((row) => row[c]));
        if (indicator === "") continue;

        const cumulat = toNumber(values[c]);
        if (cumulat !== null) {
          items.push({ indicator, series: "cumulat", value: cumulat });
        }
        if (!hasPeriodRow) continue;

        const perioada = toNumber(period[c]);
        if (perioada !== null) {
          items.push({ indicator, series: "perioada", value: perioada });
        }
      }
      return items;
    },
  };
}

export const ROW_PARSERS: StatParser[] = [
  rowParser({
    kind: "gratiere",
    label: "Grațiere",
    keywords: ["grațiere", "demersuri parvenite"],
    rowPrefix: "Penitenciarul nr. 6",
    headerRows: 6,
    hasPeriodRow: false,
  }),
  rowParser({
    kind: "comisia",
    label: "Comisia penitenciară (art. 91, 92 CP)",
    keywords: ["comisiile penitenciare", "art. 91 cp"],
    rowPrefix: "Penitenciarul nr. 6",
    headerRows: 4,
    hasPeriodRow: true,
  }),
  rowParser({
    kind: "mc",
    label: "Mecanismul compensatoriu (art. 473/2, 473/3 CPP)",
    keywords: ["mecanismul compensatoriu", "redus din termen"],
    rowPrefix: "Penitenciarul nr. 6",
    headerRows: 2,
    hasPeriodRow: true,
  }),
  rowParser({
    kind: "sedinte",
    label: "Ședințe de judecată și acțiuni de urmărire penală",
    keywords: ["dispoziții de escortare", "teleconferință"],
    rowPrefix: "6 ",
    headerRows: 3,
    hasPeriodRow: false,
  }),
];
