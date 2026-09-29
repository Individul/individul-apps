import { addDays, addYears, differenceInCalendarDays } from "date-fns";

import { parseISODate, toISODate } from "./periods";
import { fold } from "./text";

/** Un rând din registrul contravenienților (migrarea 0031). */
export interface Contravener {
  id: string;
  last_name: string;
  first_name: string;
  /** Opțional: nu toți au patronimic. */
  patronymic: string | null;
  /** Data hotărârii (AAAA-LL-ZZ). */
  decision_date: string;
  /** Data devenirii definitive; null cât timp nu e știută. */
  final_date: string | null;
  arrest_days: number;
  /** Ziua în care arestul a fost pus în executare; null cât timp nu a fost. */
  executed_on: string | null;
  /** Când s-a bifat informarea despre prescripție ca expediată (0032). */
  informed_at: string | null;
  informed_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Ce vine din formular: totul ca text, cum îl dă câmpul. */
export interface ContravenerInput {
  last_name: string;
  first_name: string;
  patronymic: string;
  decision_date: string;
  final_date: string;
  arrest_days: string;
  /** Gol când arestul nu a fost executat. */
  executed_on: string;
}

/**
 * Cel mai lung arest contravențional pe care îl poate da legea: 30 de zile,
 * iar la cumul de contravenții 60 (Codul contravențional, art. 38).
 *
 * Nu e o limită a registrului, e o plasă pentru degetul care apasă o cifră în
 * plus: „300" în loc de „30" ar intra altfel în registru fără ca cineva să
 * observe, iar numărul de zile e chiar pedeapsa. Stă aici și nu în bază, ca o
 * lege schimbată să ceară o linie de cod, nu o migrare făcută în grabă.
 */
export const MAX_ARREST_DAYS = 60;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** O zi AAAA-LL-ZZ care chiar există — „2026-02-30" trece de tipar, dar nu de aici. */
function ziValida(s: string): boolean {
  if (!ISO.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  // V8 rostogolește „30 februarie" la 2 martie fără să se plângă. Scrisă la
  // loc, ziua trebuie să iasă identică, altfel data nu există.
  const inapoi = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return inapoi === s;
}

/**
 * Ce e greșit în formular, sau `null` dacă se poate salva.
 *
 * O singură funcție, folosită de acțiunea de pe server: acolo e poarta reală.
 * Formularul din browser se bazează pe ea prin răspunsul acțiunii, nu pe o a
 * doua listă de reguli — două liste s-ar fi despărțit la prima regulă nouă.
 */
export function validateContravener(input: ContravenerInput, azi?: string): string | null {
  if (!input.last_name.trim()) return "Numele e obligatoriu.";
  if (!input.first_name.trim()) return "Prenumele e obligatoriu.";

  if (!input.decision_date) return "Data hotărârii e obligatorie.";
  if (!ziValida(input.decision_date)) return "Data hotărârii nu e o zi care există.";

  if (input.final_date) {
    if (!ziValida(input.final_date)) return "Data devenirii definitive nu e o zi care există.";
    // Aceeași regulă ca `contraveners_final_after_decision` din bază, spusă
    // aici în română: altfel omul ar primi mesajul Postgres, în engleză.
    if (input.final_date < input.decision_date) {
      return "Hotărârea nu poate deveni definitivă înainte de data ei.";
    }
  }

  const zileText = input.arrest_days.trim();
  if (!zileText) return "Numărul de zile de arest e obligatoriu.";
  // Doar cifre: `Number("1e1")` ar da 10, iar „12.5" ar trece de `Number` și
  // ar pica abia în bază, pe coloana `integer`.
  if (!/^\d+$/.test(zileText)) return "Zilele de arest se scriu ca număr întreg.";
  const zile = Number(zileText);
  if (zile < 1) return "Arestul are cel puțin o zi.";
  if (zile > MAX_ARREST_DAYS) {
    return `Arestul contravențional nu trece de ${MAX_ARREST_DAYS} de zile, nici la cumul. Verifică cifra.`;
  }

  if (input.executed_on) {
    if (!ziValida(input.executed_on)) return "Data executării nu e o zi care există.";
    // Aceeași regulă ca `contraveners_executed_after_decision` din bază.
    if (input.executed_on < input.decision_date) {
      return "Arestul nu poate fi executat înainte de data hotărârii.";
    }
    // Ziua de azi vine de la server, pe ora Chișinăului. O executare „mâine"
    // ar stinge de pe acum avertizarea de prescripție pentru un om care încă
    // n-a intrat pe ușă.
    if (azi && input.executed_on > azi) return "Data executării nu poate fi în viitor.";
  }
  return null;
}

/*
 * Prescripția executării.
 *
 * Hotărârea de arest contravențional nu mai poate fi pusă în executare dacă a
 * trecut un an de la data la care a devenit definitivă. Termenul se socotește
 * pe calendar: ultima zi în care se mai poate executa e ziua cu același număr,
 * în aceeași lună, peste un an. De a doua zi, hotărârea e prescrisă.
 *
 * Un 29 februarie trece în 28 februarie al anului următor (`addYears` face
 * asta): ziua nu există, iar a o împinge în 1 martie ar lungi termenul peste
 * un an.
 */
export const TERMEN_PRESCRIPTIE_ANI = 1;

/** Cu câte zile înainte de expirare se aprinde avertizarea. */
export const AVERTIZARE_ZILE = 30;

/** Ultima zi în care hotărârea se mai poate pune în executare. */
export function ultimaZiDeExecutare(finalDate: string): string {
  return toISODate(addYears(parseISODate(finalDate), TERMEN_PRESCRIPTIE_ANI));
}

export type Prescriptie =
  /** Arestul a fost executat: termenul nu mai contează. */
  | { stare: "executat"; executatLa: string }
  /** Fără dată definitivă termenul nu se poate socoti. */
  | { stare: "fara_data" }
  | { stare: "in_termen"; ultimaZi: string; zileRamase: number }
  /** Mai sunt cel mult `AVERTIZARE_ZILE` zile; 0 înseamnă că azi e ultima zi. */
  | { stare: "expira_curand"; ultimaZi: string; zileRamase: number }
  | { stare: "prescris"; prescrisDin: string; informatLa: string | null };

/**
 * Unde se află hotărârea față de termenul de executare, în ziua `azi`.
 *
 * `azi` e o zi AAAA-LL-ZZ, nu un instant, și se primește ca argument: pagina îl
 * citește o dată, pe ora Chișinăului, și îl dă mai departe. Luat cu
 * `new Date()` în browser, lista ar fi putut spune altceva decât serverul la
 * miezul nopții, iar probele n-ar fi avut cum fixa ziua.
 */
export function prescriptieOf(
  c: Pick<Contravener, "final_date" | "executed_on" | "informed_at">,
  azi: string,
): Prescriptie {
  if (c.executed_on) return { stare: "executat", executatLa: c.executed_on };
  if (!c.final_date) return { stare: "fara_data" };

  const ultimaZi = ultimaZiDeExecutare(c.final_date);
  const zileRamase = differenceInCalendarDays(parseISODate(ultimaZi), parseISODate(azi));
  if (zileRamase < 0) {
    return {
      stare: "prescris",
      prescrisDin: toISODate(addDays(parseISODate(ultimaZi), 1)),
      informatLa: c.informed_at,
    };
  }
  if (zileRamase <= AVERTIZARE_ZILE) return { stare: "expira_curand", ultimaZi, zileRamase };
  return { stare: "in_termen", ultimaZi, zileRamase };
}

/** Prescrisă și fără informare expediată — cele pentru care e ceva de făcut. */
export function deInformat(
  c: Pick<Contravener, "final_date" | "executed_on" | "informed_at">,
  azi: string,
): boolean {
  const p = prescriptieOf(c, azi);
  return p.stare === "prescris" && !p.informatLa;
}

export type ContravenerFilter = "toti" | "de_informat" | "expira_curand";

/**
 * Alege din listă după termen.
 *
 * „Expiră curând" le cuprinde pe cele încă executabile, cu cel mult
 * `AVERTIZARE_ZILE` zile rămase — cele la care se mai poate face ceva înainte
 * de prescripție. Cele deja prescrise stau la „De informat", nu aici.
 */
export function filterContraveners(
  rows: Contravener[],
  filter: ContravenerFilter,
  azi: string,
): Contravener[] {
  if (filter === "toti") return rows;
  if (filter === "de_informat") return rows.filter((c) => deInformat(c, azi));
  return rows.filter((c) => prescriptieOf(c, azi).stare === "expira_curand");
}

/** Câte sunt la fiecare filtru, pentru pastile și pentru avertizarea de sus. */
export function countPrescriptie(
  rows: Contravener[],
  azi: string,
): { deInformat: number; expiraCurand: number } {
  let de = 0;
  let curand = 0;
  for (const c of rows) {
    const p = prescriptieOf(c, azi);
    if (p.stare === "prescris" && !p.informatLa) de++;
    else if (p.stare === "expira_curand") curand++;
  }
  return { deInformat: de, expiraCurand: curand };
}

/** Numele întreg, cum se citește într-o listă: nume, prenume, patronimic. */
export function fullName(c: Pick<Contravener, "last_name" | "first_name" | "patronymic">): string {
  return [c.last_name, c.first_name, c.patronymic].filter(Boolean).join(" ");
}

/**
 * Cele mai recente hotărâri întâi.
 *
 * Nu alfabetic, ca la inculpați: acolo omul stă luni întregi și e căutat după
 * nume, aici un arest ține zile, iar ce se lucrează e ce a venit acum. Numele
 * se caută oricum din câmpul de căutare. La aceeași zi decide numele, ca
 * ordinea să nu sară între două încărcări ale paginii.
 */
export function sortContraveners(rows: Contravener[]): Contravener[] {
  return [...rows].sort(
    (a, b) =>
      b.decision_date.localeCompare(a.decision_date) ||
      fullName(a).localeCompare(fullName(b), "ro"),
  );
}

/** Se potrivește cu ce s-a scris în căutare? Fără diacritice, ca peste tot. */
export function matchesContravener(c: Contravener, query: string): boolean {
  const q = fold(query.trim());
  return !q || fold(fullName(c)).includes(q);
}
