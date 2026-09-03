import date from "./infractiuni.json";
import { ORDINE_GRAVITATE, type Categorie } from "./categorii";

/**
 * Clasificarea unei infracțiuni după articol și alineat.
 *
 * Portată din `Individul/clasificare`. Catalogul are 664 de intrări acoperind
 * 250 de articole; alineatele pot avea exponenți („1¹"), iar unele articole au
 * ele însele o parte după bară („217/1"), de unde și căutarea în două trepte.
 */

export interface Infractiune {
  art: string;
  alin: string;
  cat: Categorie;
  pedeapsa_max: string;
}

export const INFRACTIUNI = (date as { infractiuni: Infractiune[] }).infractiuni;

/**
 * Desparte ce a scris omul: „217/1" e articolul 217/1, nu articolul 217
 * alineatul 1. Bara face parte din numărul articolului în Codul penal.
 */
export function parseArticol(input: string): { articol: string; alineatDinArticol: string | null } {
  if (!input) return { articol: "", alineatDinArticol: null };
  const parts = input.split("/");
  return { articol: parts[0], alineatDinArticol: parts[1] || null };
}

/**
 * Caută infracțiunea. Întâi potrivire directă; dacă nu, se încearcă articolele
 * cu bară, fiindcă „217" + alineatul „1" poate fi scris în catalog ca „217/1".
 */
export function gasesteInfractiune(
  articol: string,
  alineat: string,
  catalog: Infractiune[] = INFRACTIUNI,
): Infractiune | null {
  const directa = catalog.find((i) => i.art === articol && i.alin === alineat);
  if (directa) return directa;

  if (/^\d+$/.test(articol)) {
    const cuBara = catalog.find((i) => i.art.split("/")[0] === articol && i.alin === alineat);
    if (cuBara) return cuBara;
  }
  return null;
}

export interface CeaMaiGrava {
  categorie: Categorie | null;
  articolDeterminant: string;
  infractiune: Infractiune | null;
}

/**
 * Cea mai gravă dintre infracțiunile adăugate — ea dă categoria pe care se
 * calculează fracțiile. Se întoarce și care anume a hotărât, fiindcă altfel
 * rezultatul ar fi o literă fără explicație.
 */
export function ceaMaiGrava(adaugate: Infractiune[]): CeaMaiGrava {
  if (adaugate.length === 0) {
    return { categorie: null, articolDeterminant: "", infractiune: null };
  }
  let maxIndex = -1;
  let determinanta: Infractiune | null = null;
  for (const inf of adaugate) {
    const i = ORDINE_GRAVITATE.indexOf(inf.cat);
    if (i > maxIndex) {
      maxIndex = i;
      determinanta = inf;
    }
  }
  return {
    categorie: ORDINE_GRAVITATE[maxIndex],
    articolDeterminant: determinanta ? `Art. ${determinanta.art} alin. ${determinanta.alin}` : "",
    infractiune: determinanta,
  };
}

/** Alineatele existente pentru un articol, pentru lista din formular. */
export function alineatePentru(articol: string, catalog: Infractiune[] = INFRACTIUNI): string[] {
  const baza = articol.split("/")[0];
  return catalog
    .filter((i) => i.art === articol || i.art.split("/")[0] === baza)
    .map((i) => i.alin);
}

/** Articolele distincte din catalog, în ordine numerică. */
export function articole(catalog: Infractiune[] = INFRACTIUNI): string[] {
  const set = [...new Set(catalog.map((i) => i.art))];
  return set.sort((a, b) => {
    const [na, sa] = a.split("/");
    const [nb, sb] = b.split("/");
    return Number(na) - Number(nb) || (sa ?? "").localeCompare(sb ?? "");
  });
}
