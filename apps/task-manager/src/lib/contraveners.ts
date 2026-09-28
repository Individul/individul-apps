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
export function validateContravener(input: ContravenerInput): string | null {
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
  return null;
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
