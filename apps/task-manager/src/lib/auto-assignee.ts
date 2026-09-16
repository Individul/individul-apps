import { fold } from "./text";
import type { Profile } from "./types";

/**
 * Împărțirea lucrului între colege, după litera cu care începe: numele
 * petiționarului la petiții, titlul la sarcini.
 *
 * Aceeași listă de litere pentru amândouă, dinadins: e o singură împărțire a
 * alfabetului între aceleași două colege, nu două reguli care s-ar putea
 * depărta una de alta pe tăcute.
 *
 * Literele sunt scrise pliate — fără diacritice și cu minuscule — fiindcă asta
 * întoarce `fold`. Nu e o simplificare: „Ș" merge la aceeași persoană ca „S", iar
 * „Î" la aceeași ca „I", deci plierea nu desparte nimic din ce s-a cerut. La
 * fel, „Ă" și „Â" ajung la „A". Dacă vreodată o literă cu diacritic trebuie să
 * meargă altundeva decât cea de bază, regula asta nu mai e de ajuns și trebuie
 * rescrisă, nu completată.
 *
 * K, Q, X și Y nu apar în nicio listă, dinadins: pe registrul de până acum — 332
 * de petiții — niciun petiționar nu începe cu ele. Dacă apare unul, câmpul rămâne
 * gol și alege omul, ceea ce e mai bine decât o atribuire ghicită.
 */
const DUPA_LITERA: { nume: string; litere: string }[] = [
  { nume: "Natalia Spinei", litere: "cdefghijlmno" },
  { nume: "Ana Cojocari", litere: "abprstuvwz" },
];

/**
 * Cine ar trebui să primească lucrarea, după textul care o deschide.
 *
 * `null` înseamnă „nu știu" și se traduce printr-un câmp lăsat gol, nu printr-o
 * ghicire: text gol, primul caracter neacoperit (o cifră, o ghilimea, o literă
 * din afara listelor), sau persoana din regulă negăsită printre profiluri.
 *
 * Ultimul caz merită atenție: potrivirea se face pe nume, deci dacă una dintre
 * colege își schimbă numele în profil, regula încetează să se aplice — tăcut,
 * dar fără să greșească. Atunci se schimbă numele aici, într-un rând.
 */
export function autoAssignee(text: string, profiles: Profile[]): string | null {
  const litera = fold(text.trim())[0];
  if (!litera) return null;

  const regula = DUPA_LITERA.find((r) => r.litere.includes(litera));
  if (!regula) return null;

  const persoana = profiles.find((p) => fold(p.full_name ?? "") === fold(regula.nume));
  return persoana?.id ?? null;
}

/** Literele acoperite, pentru teste și pentru orice verificare de acoperire. */
export const LITERE_ACOPERITE = DUPA_LITERA;
