/**
 * Calculul termenelor de executare, după regulile RM.
 *
 * Portat din `Individul/clasificare`, unde stătea în interiorul componentei de
 * ecran, fără niciun test. Aici e cod curat, cu teste — un calcul de termen
 * greșit nu se vede pe ecran ca o eroare, se vede ca o dată plauzibilă.
 *
 * Regula care miră pe cine n-o știe: un termen exprimat în ani sau luni expiră
 * în ziua PRECEDENTĂ zilei corespunzătoare. Un an de la 10 martie 2026 se
 * încheie pe 9 martie 2027, nu pe 10.
 */

export interface Termen {
  ani: number;
  luni: number;
  zile: number;
}

const ZERO: Termen = { ani: 0, luni: 0, zile: 0 };

/**
 * Adaugă luni cu retezare la sfârșitul lunii, și spune dacă a retezat.
 *
 * `setMonth` din JavaScript rostogolește: 31 ianuarie plus o lună dă 3 martie.
 * Calendarul juridic nu se poartă așa — o lună de la 31 ianuarie se încheie în
 * februarie, fiindcă „31 februarie" nu există. Retezarea trebuie și raportată,
 * nu doar făcută: de ea atârnă regula de mai jos.
 */
function adaugaLuni(d: Date, luni: number): { data: Date; retezat: boolean } {
  const zi = d.getDate();
  const tinta = new Date(d.getFullYear(), d.getMonth() + luni, 1);
  const ultimaZi = new Date(tinta.getFullYear(), tinta.getMonth() + 1, 0).getDate();
  return {
    data: new Date(tinta.getFullYear(), tinta.getMonth(), Math.min(zi, ultimaZi)),
    retezat: zi > ultimaZi,
  };
}

/**
 * Adaugă un termen la o dată.
 *
 * `scadeOZi` aplică regula zilei precedente — dar NU când s-a retezat. Cele două
 * reguli spun același lucru din capete diferite: termenul expiră la data
 * corespunzătoare din ultima lună, iar dacă acea zi nu există în luna aceea,
 * expiră în ultima ei zi. Când s-a retezat, ultima zi a lunii E expirarea, deci
 * n-are de unde să mai dea un pas înapoi.
 *
 * Verificat pe cazul dat de utilizator: 31.01.2026 plus o lună se încheie pe
 * 28.02.2026 — nu pe 27 (scăzând o zi din februarie retezat) și nici pe 2 martie
 * (cum dădea rostogolirea din aplicația de origine).
 */
export function adaugaTermen(data: Date, t: Termen, scadeOZi = false): Date {
  let rez = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  let retezat = false;

  if (t.ani > 0) {
    const x = adaugaLuni(rez, t.ani * 12);
    rez = x.data;
    retezat = retezat || x.retezat;
  }
  if (t.luni > 0) {
    const x = adaugaLuni(rez, t.luni);
    rez = x.data;
    retezat = retezat || x.retezat;
  }
  if (t.zile > 0) {
    rez = new Date(rez.getFullYear(), rez.getMonth(), rez.getDate() + t.zile);
  }
  if (scadeOZi && !retezat) rez.setDate(rez.getDate() - 1);
  return rez;
}

/**
 * Sfârșitul termenului: data începerii plus termenul, minus o zi.
 *
 * Asta cere secția cel mai des — până când e omul de ținut.
 */
export function sfarsitTermen(dataInceput: Date, t: Termen): Date {
  return adaugaTermen(dataInceput, t, true);
}

/**
 * Fracția dintr-un termen, păstrând structura ani/luni/zile.
 *
 * Nu se convertește totul în zile: jumătate dintr-un an înseamnă 6 luni, nu
 * 182 sau 183 de zile — iar cele două nu cad în aceeași dată. Resturile curg în
 * jos: din luni în zile la 30 de zile pe lună, apoi se normalizează înapoi.
 */
export function fractieDinTermen(t: Termen, fractie: string): Termen {
  const [numarator, numitor] = fractie.split("/").map(Number);
  if (!numarator || !numitor) return { ...ZERO };

  const totalLuni = t.ani * 12 + t.luni;
  const luniFractie = Math.floor((totalLuni * numarator) / numitor);
  const restLuni = (totalLuni * numarator) % numitor;
  const zileDinRest = Math.floor((restLuni * 30) / numitor);
  let zile = Math.floor((t.zile * numarator) / numitor) + zileDinRest;

  let ani = Math.floor(luniFractie / 12);
  let luni = luniFractie % 12;

  if (zile >= 30) {
    luni += Math.floor(zile / 30);
    zile = zile % 30;
  }
  if (luni >= 12) {
    ani += Math.floor(luni / 12);
    luni = luni % 12;
  }
  return { ani, luni, zile };
}

/** Termenul scris în cuvinte: „2 ani, 6 luni și 10 zile". */
export function termenText(t: Termen): string {
  const p: string[] = [];
  if (t.ani > 0) p.push(`${t.ani} ${t.ani === 1 ? "an" : "ani"}`);
  if (t.luni > 0) p.push(`${t.luni} ${t.luni === 1 ? "lună" : "luni"}`);
  if (t.zile > 0) p.push(`${t.zile} ${t.zile === 1 ? "zi" : "zile"}`);
  if (p.length === 0) return "0 zile";
  if (p.length === 1) return p[0];
  return `${p.slice(0, -1).join(", ")} și ${p[p.length - 1]}`;
}

/**
 * Zilele de arest preventiv dintre două date.
 *
 * Regula `[start, end)`: se include ziua de început, se exclude cea de sfârșit.
 * Documentată în aplicația de origine cu exemplul ei: 29.01.2015 – 29.04.2015
 * fac 90 de zile. Numărate „inclusiv la ambele capete" ar da 91, iar o zi în
 * plus la arest e o zi în minus la pedeapsă.
 *
 * Se socotește pe zile calendaristice, la amiază, ca trecerea la ora de vară să
 * nu scurteze o zi din diferență.
 */
export function zileIntre(start: Date, sfarsit: Date): number {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
  const b = new Date(sfarsit.getFullYear(), sfarsit.getMonth(), sfarsit.getDate(), 12);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Scade zilele de arest preventiv dintr-o dată deja calculată. */
export function scadeArest(data: Date, zileArest: number): Date {
  if (!zileArest) return data;
  const rez = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  rez.setDate(rez.getDate() - zileArest);
  return rez;
}

export interface RezultatTermen {
  /** Când se încheie pedeapsa, fără a socoti arestul preventiv. */
  sfarsit: Date;
  /** Același sfârșit, cu arestul preventiv scăzut. */
  sfarsitCuArest: Date;
  /** Cât trebuie executat pentru fracția cerută. */
  deExecutat: Termen;
  /** Data de la care se poate cere, cu arestul preventiv scăzut. */
  eligibil: Date;
}

/**
 * Tot calculul dintr-o dată: sfârșitul pedepsei și data de eligibilitate.
 *
 * Arestul preventiv se scade la sfârșit, din data calculată — nu din termen
 * înainte de a-l adăuga. Ordinea contează: scăzut întâi, s-ar pierde regula
 * zilei precedente, care se aplică termenului, nu rezultatului.
 */
export function calculeazaTermen(
  dataInceput: Date,
  pedeapsa: Termen,
  fractie: string,
  zileArest = 0,
): RezultatTermen {
  const sfarsit = sfarsitTermen(dataInceput, pedeapsa);
  const deExecutat = fractieDinTermen(pedeapsa, fractie);
  const eligibilBrut = adaugaTermen(dataInceput, deExecutat);
  return {
    sfarsit,
    sfarsitCuArest: scadeArest(sfarsit, zileArest),
    deExecutat,
    eligibil: scadeArest(eligibilBrut, zileArest),
  };
}
