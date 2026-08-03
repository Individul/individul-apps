export type Regime = "inchis" | "semiinchis";
export type DefendantStatus = "inculpat" | "condamnat";

export interface Defendant {
  id: string;
  last_name: string;
  first_name: string;
  regime: Regime;
  established_on: string;
  court: string | null;
  case_number: string | null;
  status: DefendantStatus;
  /** Data trecerii la condamnat; null cât timp e inculpat. */
  convicted_on: string | null;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const REGIME_LABEL: Record<Regime, string> = {
  inchis: "Închis",
  semiinchis: "Semiînchis",
};

export const REGIME_OPTIONS: { value: Regime; label: string }[] = [
  { value: "inchis", label: "Închis" },
  { value: "semiinchis", label: "Semiînchis" },
];

export interface DefendantCounts {
  /** Inculpați acum, pe tip. */
  inchis: number;
  semiinchis: number;
  inculpati: number;
  condamnati: number;
  total: number;
}

/**
 * Cifrele registrului.
 *
 * Pe tip se numără **doar inculpații**: cei condamnați au ieșit din grija
 * curentă, iar amestecați în aceleași cifre ar face „câți avem acum" să crească
 * la nesfârșit, adică exact numărul pe care nimeni nu-l poate folosi.
 */
export function countDefendants(rows: Defendant[]): DefendantCounts {
  let inchis = 0;
  let semiinchis = 0;
  let condamnati = 0;

  for (const d of rows) {
    if (d.status === "condamnat") {
      condamnati++;
      continue;
    }
    if (d.regime === "inchis") inchis++;
    else semiinchis++;
  }

  return {
    inchis,
    semiinchis,
    inculpati: inchis + semiinchis,
    condamnati,
    total: rows.length,
  };
}

/** Numele întreg, cum se citește într-o listă. */
export function fullName(d: Defendant): string {
  return `${d.last_name} ${d.first_name}`;
}

/**
 * Inculpații, alfabetic. Registrul se citește căutând un nume, nu urmărind
 * ordinea în care au fost introduși.
 */
export function activeDefendants(rows: Defendant[]): Defendant[] {
  return rows
    .filter((d) => d.status === "inculpat")
    .sort((a, b) => fullName(a).localeCompare(fullName(b), "ro"));
}

/** Cei trecuți la condamnat, cei mai recenți întâi. */
export function convictedDefendants(rows: Defendant[]): Defendant[] {
  return rows
    .filter((d) => d.status === "condamnat")
    .sort((a, b) => (b.convicted_on ?? "").localeCompare(a.convicted_on ?? ""));
}
