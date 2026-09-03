import { fold } from "./text";
import type { Defendant } from "./defendants";
import type { TransferPlan } from "./transfer-plans";
import type { Petition, Task } from "./types";
import { institutionLabel } from "./transfers";

/**
 * Căutare peste toate registrele.
 *
 * Rostul ei nu e „să găsești mai repede o petiție" — pentru asta fiecare modul
 * are deja filtrul lui. Rostul e că același om e împrăștiat prin patru
 * registre: poate fi deodată titlu de sarcină, petiționar, om pe lista de
 * transfer și prevenit. Întrebarea care se pune de fapt în secție e „ce avem pe
 * X?", iar până acum ea cerea patru căutări și o ținere de minte.
 *
 * Se caută în memorie, nu în baza de date, fiindcă toate registrele la un loc
 * fac în jur de 400 de rânduri. Nu e o scurtătură: `fold` ignoră diacriticele,
 * deci „Tiganciuc" găsește „Țiganciuc", ceea ce un `ilike` din Postgres n-ar
 * face fără extensia `unaccent` și o migrare. Tiparul ține câți ani cresc
 * registrele cu câteva sute pe an; peste vreo cinci mii de rânduri, căutarea va
 * trebui mutată în bază.
 */

export type SearchKind = "sarcina" | "petitie" | "transfer" | "prevenit";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  /** Rândul de sus: numele sub care se recunoaște. */
  title: string;
  /** Rândul de jos: instanța, dosarul, starea — ce deosebește două rânduri asemenea. */
  detail: string | null;
  href: string;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
  /** Câte au mai rămas nearătate, peste `LIMIT_PE_GRUP`. */
  more: number;
}

/**
 * Sub două litere nu se caută: o singură literă potrivește aproape orice, deci
 * ar întoarce tot registrul sub formă de „rezultate".
 */
export const MIN_QUERY = 2;

/** Cât se arată dintr-un grup. Restul se numără, ca omul să știe că mai sunt. */
export const LIMIT_PE_GRUP = 6;

const LABEL: Record<SearchKind, string> = {
  sarcina: "Sarcini",
  petitie: "Petiții",
  transfer: "Planificare transferuri",
  prevenit: "Preveniți și inculpați",
};

/** Ordinea grupurilor: cele cu cel mai des căutat conținut întâi. */
const ORDINE: SearchKind[] = ["sarcina", "petitie", "transfer", "prevenit"];

interface Candidat {
  hit: SearchHit;
  /** Textul în care se caută, deja pliat — nu se pliază la fiecare tastă. */
  haystack: string;
}

function candidat(hit: SearchHit, parti: (string | null | undefined)[]): Candidat {
  return { hit, haystack: fold(parti.filter(Boolean).join(" ")) };
}

/** Rândul de jos, din bucățile care există. `null` când n-a rămas niciuna. */
function detaliu(parti: (string | null | undefined)[]): string | null {
  const p = parti.filter((x): x is string => Boolean(x));
  return p.length ? p.join(" · ") : null;
}

export type TaskRow = Pick<Task, "id" | "title" | "description" | "status">;
export type PetitionRow = Pick<Petition, "id" | "number" | "petitioner" | "subject" | "status">;
export type PlanRow = Pick<
  TransferPlan,
  "id" | "last_name" | "first_name" | "court" | "institution" | "note" | "done"
>;
export type DefendantRow = Pick<
  Defendant,
  "id" | "last_name" | "first_name" | "court" | "case_number" | "status" | "preventive_measure"
>;

export interface SearchData {
  tasks: TaskRow[];
  petitions: PetitionRow[];
  plans: PlanRow[];
  defendants: DefendantRow[];
}

function candidati(data: SearchData): Candidat[] {
  const out: Candidat[] = [];

  for (const t of data.tasks) {
    out.push(
      candidat(
        {
          kind: "sarcina",
          id: t.id,
          title: t.title,
          detail: t.status === "done" ? "finalizată" : null,
          href: `/tasks/${t.id}`,
        },
        [t.title, t.description],
      ),
    );
  }

  for (const p of data.petitions) {
    out.push(
      candidat(
        {
          kind: "petitie",
          id: p.id,
          title: `${p.number} — ${p.petitioner}`,
          detail: p.subject || (p.status === "solutionat" ? "soluționată" : null),
          // Se deschide chiar petiția, nu registrul; vezi `notificationHref`.
          href: `/petitii?petitie=${p.id}`,
        },
        [p.number, p.petitioner, p.subject],
      ),
    );
  }

  for (const p of data.plans) {
    if (p.done) continue; // încheiate: ies din lista de lucru
    out.push(
      candidat(
        {
          kind: "transfer",
          id: p.id,
          title: `${p.last_name} ${p.first_name}`,
          detail: detaliu([p.court, institutionLabel(p.institution)]),
          href: "/transferuri/planificare",
        },
        [p.last_name, p.first_name, p.court, p.note],
      ),
    );
  }

  for (const d of data.defendants) {
    const categorie =
      d.status === "condamnat" ? "condamnat" : d.preventive_measure ? "prevenit" : "inculpat";
    out.push(
      candidat(
        {
          kind: "prevenit",
          id: d.id,
          title: `${d.last_name} ${d.first_name}`,
          detail: detaliu([categorie, d.court, d.case_number ? `dosar ${d.case_number}` : null]),
          href: "/inculpati",
        },
        [d.last_name, d.first_name, d.court, d.case_number],
      ),
    );
  }

  return out;
}

/** Grupurile cu rezultate, în ordine fixă. Grupurile goale nu apar. */
export function search(query: string, data: SearchData): SearchGroup[] {
  const q = fold(query.trim());
  if (q.length < MIN_QUERY) return [];

  const gasite = candidati(data).filter((c) => c.haystack.includes(q));

  return ORDINE.map((kind) => {
    const toate = gasite.filter((c) => c.hit.kind === kind).map((c) => c.hit);
    return {
      kind,
      label: LABEL[kind],
      hits: toate.slice(0, LIMIT_PE_GRUP),
      more: Math.max(0, toate.length - LIMIT_PE_GRUP),
    };
  }).filter((g) => g.hits.length > 0);
}

/** Câte rezultate în total, pentru mesajul „N rezultate". */
export function countHits(groups: SearchGroup[]): number {
  return groups.reduce((n, g) => n + g.hits.length + g.more, 0);
}
