import { optionsFrom } from "./options";

export type Regime = "inchis" | "semiinchis";
export type DefendantStatus = "inculpat" | "condamnat";

/**
 * Categoria sub care se citește omul în registru.
 *
 * Nu se stochează: se calculează din stare și din măsura preventivă. Ținută ca
 * o coloană separată, ar fi trebuit adusă la zi de mână la fiecare schimbare a
 * măsurii — iar prima dată când cineva ar fi uitat, registrul ar fi spus două
 * lucruri deodată despre același om.
 */
export type DefendantCategory = "prevenit" | "inculpat" | "condamnat";

export interface Defendant {
  id: string;
  last_name: string;
  first_name: string;
  regime: Regime;
  established_on: string;
  court: string | null;
  case_number: string | null;
  status: DefendantStatus;
  /** Data trecerii la condamnat; null cât timp nu e condamnat. */
  convicted_on: string | null;
  /** Are măsură preventivă? De aici se citește „prevenit". */
  preventive_measure: boolean;
  /** Data măsurii, dacă e știută. Fără măsură rămâne mereu null. */
  preventive_measure_on: string | null;
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

/** Derivate din hartă, nu scrise a doua oară — vezi `optionsFrom`. */
export const REGIME_OPTIONS = optionsFrom(REGIME_LABEL);

export const CATEGORY_LABEL: Record<DefendantCategory, string> = {
  prevenit: "Prevenit",
  inculpat: "Inculpat",
  condamnat: "Condamnat",
};

/** Condamnarea are întâietate: odată condamnat, măsura preventivă nu-l mai descrie. */
export function categoryOf(d: Defendant): DefendantCategory {
  if (d.status === "condamnat") return "condamnat";
  return d.preventive_measure ? "prevenit" : "inculpat";
}

/**
 * Ce se alege din lista de lucru; „toti" e lista de azi, neschimbată.
 *
 * „condamnat" lipsește dinadins dintre valori: condamnații au secțiunea lor,
 * pliabilă, sub listă. O a patra pastilă care ar goli lista principală ca să
 * umple o secțiune închisă ar cere două gesturi pentru un singur lucru.
 */
export type DefendantCategoryFilter = "toti" | "prevenit" | "inculpat";

export const CATEGORY_FILTER_LABEL: Record<DefendantCategoryFilter, string> = {
  toti: "Toți",
  prevenit: "Preveniți",
  inculpat: "Inculpați",
};

/** Derivate din hartă, ca `REGIME_OPTIONS` — ordinea din hartă e ordinea pastilelor. */
export const CATEGORY_FILTER_OPTIONS = optionsFrom(CATEGORY_FILTER_LABEL);

/** Ce se spune când lista filtrată e goală; depinde de ce s-a cerut, nu de ce există. */
export const CATEGORY_FILTER_EMPTY: Record<DefendantCategoryFilter, string> = {
  toti: "Niciun inculpat în evidență.",
  prevenit: "Niciun prevenit în evidență.",
  inculpat: "Niciun inculpat fără măsură preventivă.",
};

/**
 * Alege din listă după categorie.
 *
 * Se citește prin `categoryOf`, nu direct din `preventive_measure`: așa un
 * condamnat cu măsura rămasă bifată nu iese la „Preveniți", adică exact
 * întâietatea condamnării după care se face și banda de cifre. Aceeași regulă
 * scrisă a doua oară aici ar fi putut să se despartă de aceea la prima
 * schimbare.
 *
 * Nu sortează și nu reordonează: se aplică DUPĂ `activeDefendants`, care a
 * așezat deja lista alfabetic, și întoarce oamenii în ordinea primită.
 */
export function filterByCategory(
  rows: Defendant[],
  filter: DefendantCategoryFilter,
): Defendant[] {
  if (filter === "toti") return rows;
  return rows.filter((d) => categoryOf(d) === filter);
}

/** Câți, și din ei câți la fiecare tip de penitenciar. */
export interface RegimeCounts {
  inchis: number;
  semiinchis: number;
  total: number;
}

export interface DefendantCounts {
  /** Toți cei aflați acum în grijă — preveniți plus inculpați. */
  activi: number;
  /** Necondamnați cu măsură preventivă. */
  preveniti: number;
  /** Necondamnați fără măsură preventivă. */
  inculpati: number;
  /** Aceiași oameni ca `activi`, împărțiți după tipul de penitenciar. */
  inchis: number;
  semiinchis: number;
  condamnati: number;
  total: number;
  /**
   * Aceleași cifre încrucișate: fiecare categorie, despărțită pe tip.
   *
   * Din ea ies toate celelalte numere de mai sus, nu dintr-o a doua
   * numărătoare — două treceri prin registru, scrise separat, ar fi putut
   * ajunge să spună lucruri diferite despre aceiași oameni, iar dezacordul
   * s-ar fi văzut tocmai în banda de cifre, unde se uită omul ca să aibă
   * încredere.
   */
  peCategorie: Record<"prevenit" | "inculpat", RegimeCounts>;
}

/**
 * Cifrele registrului.
 *
 * Pe tip se numără **doar inculpații**: cei condamnați au ieșit din grija
 * curentă, iar amestecați în aceleași cifre ar face „câți avem acum" să crească
 * la nesfârșit, adică exact numărul pe care nimeni nu-l poate folosi.
 */
export function countDefendants(rows: Defendant[]): DefendantCounts {
  const gol = (): RegimeCounts => ({ inchis: 0, semiinchis: 0, total: 0 });
  const peCategorie = { prevenit: gol(), inculpat: gol() };
  let condamnati = 0;

  for (const d of rows) {
    if (d.status === "condamnat") {
      condamnati++;
      continue;
    }
    // O singură bifă pe om, în căsuța lui: măsură × tip. Toate celelalte cifre
    // se adună din tabelul ăsta, deci nu se pot contrazice cu el.
    const c = peCategorie[d.preventive_measure ? "prevenit" : "inculpat"];
    if (d.regime === "inchis") c.inchis++;
    else c.semiinchis++;
    c.total++;
  }

  const { prevenit, inculpat } = peCategorie;
  return {
    activi: prevenit.total + inculpat.total,
    preveniti: prevenit.total,
    inculpati: inculpat.total,
    // Marginile tabelului, nu o a doua numărătoare: pe tip se strâng cele două
    // categorii, la fel cum pe categorie se strâng cele două tipuri.
    inchis: prevenit.inchis + inculpat.inchis,
    semiinchis: prevenit.semiinchis + inculpat.semiinchis,
    condamnati,
    total: rows.length,
    peCategorie,
  };
}

/** Numele întreg, cum se citește într-o listă. */
export function fullName(d: Defendant): string {
  return `${d.last_name} ${d.first_name}`;
}

/**
 * Cei aflați acum în grijă — preveniți și inculpați deopotrivă — alfabetic.
 * Registrul se citește căutând un nume, nu urmărind ordinea introducerii.
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
