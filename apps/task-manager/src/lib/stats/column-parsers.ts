import type { Grid, StatItem, StatKind, StatParser } from "./types";
import { cellText, composeLabel, findCell, toNumber } from "./grid";

/** Câte rânduri de la începutul grilei se scanează pentru cuvintele-cheie. */
const DETECT_ROWS = 8;

const PEN_HEADER = /^P-\d+$/;

/**
 * Compune eticheta unui indicator din bucățile de antet, colapsând repetările
 * consecutive. Celulele îmbinate din Excel apar ca aceeași valoare pe toate
 * coloanele acoperite („Plafonul de detenție" pe A și B), iar fără colapsare
 * eticheta ar deveni „Plafonul de detenție / Plafonul de detenție".
 */
export function labelFromParts(parts: unknown[]): string {
  const kept: string[] = [];
  for (const part of parts) {
    const text = cellText(part);
    if (text === "" || text === kept[kept.length - 1]) continue;
    kept.push(text);
  }
  return composeLabel(kept);
}

function detectScore(grid: Grid, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const haystack = grid
    .slice(0, DETECT_ROWS)
    .flatMap((row) => (row ?? []).map(cellText))
    .join(" ")
    .toLowerCase();
  const hits = keywords.filter((k) => haystack.includes(k.toLowerCase())).length;
  return hits / keywords.length;
}

/**
 * Rapoarte „pe coloane": fiecare penitenciar are o coloană, indicatorii stau
 * pe rânduri. Se caută celula `P-6`; etichetele vin din coloanele dinaintea
 * primei coloane de penitenciar din același rând de antet.
 */
export function columnParser(
  kind: StatKind,
  label: string,
  keywords: string[],
): StatParser {
  return {
    kind,
    label,
    detect(grid: Grid): number {
      if (!findCell(grid, (t) => t === "P-6")) return 0;
      return detectScore(grid, keywords);
    },
    parse(grid: Grid): StatItem[] {
      const head = findCell(grid, (t) => t === "P-6");
      if (!head) throw new Error("Nu am găsit coloana P-6 în fișier.");

      const headerRow = grid[head.row] ?? [];
      let firstPenCol = head.col;
      for (let c = 0; c < headerRow.length; c++) {
        if (PEN_HEADER.test(cellText(headerRow[c]))) {
          firstPenCol = c;
          break;
        }
      }

      const items: StatItem[] = [];
      for (let r = head.row + 1; r < grid.length; r++) {
        const row = grid[r] ?? [];
        const indicator = labelFromParts(row.slice(0, firstPenCol));
        const value = toNumber(row[head.col]);
        if (indicator === "" || value === null) continue;
        items.push({ indicator, series: "cumulat", value });
      }
      return items;
    },
  };
}

export const COLUMN_PARSERS: StatParser[] = [
  columnParser("r_lunar", "Raport lunar (situația deținuților)", [
    "deţinute",
    "plafonul",
  ]),
  columnParser("liberati", "Liberări din penitenciar", [
    "liberarea deținuților",
  ]),
  columnParser("amnistia_2016", "Amnistia 2016 (Legea nr. 210)", ["210"]),
  columnParser("amnistia_2021", "Amnistia 2021", ["comisia specială"]),
];
