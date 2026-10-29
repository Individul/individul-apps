import type { CSSProperties } from "react";

/**
 * Culorile etichetelor de la Sarcini, ca să se poată citi oricare ar fi.
 *
 * Culoarea o alege omul din Administrare, cu un selector liber. Cele închise
 * mergeau bine cu text alb, dar „Informare MAI" (#13d83a) și „Interpol"
 * (#17b5a2) ieșeau cu 1,9:1 și 2,6:1, sub pragul de 4,5:1 de la care un text
 * mic se citește fără efort. Același lucru pe dos la etichetele cu contur, unde
 * textul era chiar culoarea etichetei, pe alb (29.10.2026).
 *
 * Culoarea aleasă rămâne neatinsă pe fond și pe contur. Se potrivește doar
 * textul: pe fond plin, albul sau negrul aplicației, care dintre ele se vede
 * mai bine; pe contur, aceeași nuanță, închisă cât trebuie.
 */

/** Textul aplicației (`--foreground`, #1A1B1E). */
const TEXT_INCHIS = "#1a1b1e";
const ALB = "#ffffff";
/** Pragul WCAG AA pentru text obișnuit. */
const PRAG = 4.5;

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminanta([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrastul dintre două culori, de la 1 la 21. */
export function contrast(a: string, b: string): number {
  const ca = rgb(a);
  const cb = rgb(b);
  if (!ca || !cb) return 1;
  const [hi, lo] = [luminanta(ca), luminanta(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Textul pentru o etichetă plină: alb sau închis, care se citește mai bine. */
export function textPeCuloare(fond: string): string {
  return contrast(fond, ALB) >= contrast(fond, TEXT_INCHIS) ? ALB : TEXT_INCHIS;
}

/**
 * Aceeași nuanță, închisă până se citește pe alb. O culoare care trece deja
 * pragul rămâne cum e.
 */
export function culoarePeAlb(culoare: string): string {
  const c = rgb(culoare);
  if (!c) return TEXT_INCHIS;
  for (let k = 1; k >= 0; k -= 0.05) {
    const hex = `#${c.map((x) => Math.round(x * k).toString(16).padStart(2, "0")).join("")}`;
    if (contrast(hex, ALB) >= PRAG) return hex;
  }
  return TEXT_INCHIS;
}

/** Eticheta plină: fondul și conturul în culoarea ei, textul lizibil. */
export function stilEtichetaPlina(culoare: string): CSSProperties {
  return { backgroundColor: culoare, borderColor: culoare, color: textPeCuloare(culoare) };
}

/** Eticheta cu contur: conturul în culoarea ei, textul în nuanța închisă. */
export function stilEtichetaContur(culoare: string): CSSProperties {
  return { borderColor: culoare, color: culoarePeAlb(culoare) };
}
