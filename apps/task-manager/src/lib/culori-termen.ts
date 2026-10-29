/**
 * Culorile termenului, într-un singur loc, pentru toată aplicația.
 *
 * Roșul înseamnă „restant" și numai atât; chihlimbariul, „scadent în curând";
 * verdele, „gata". Până acum fiecare componentă își scria nuanțele ei: banda
 * de la Sarcini folosea roșul pentru „prioritate ridicată", deci același roșu
 * spunea două lucruri pe același ecran, iar „scadent" ieșea pe alocuri
 * portocaliu, pe alocuri chihlimbariu (29.10.2026).
 *
 * Clasele sunt scrise întregi, nu compuse din bucăți: Tailwind le găsește doar
 * dacă apar ca text în sursă.
 */
export type StareTermen = "restant" | "scadent" | "inTermen" | "gata";

export const CULORI_TERMEN: Record<
  StareTermen,
  { /** Banda din stânga rândului. */ bara: string; /** Punctul din vederi. */ punct: string; /** Data sau cifra. */ text: string }
> = {
  restant: { bara: "bg-red-500", punct: "bg-red-400", text: "text-red-600" },
  scadent: { bara: "bg-amber-500", punct: "bg-amber-400", text: "text-amber-600" },
  inTermen: { bara: "bg-slate-300", punct: "bg-slate-300", text: "" },
  gata: { bara: "bg-green-500", punct: "bg-green-500", text: "" },
};

/** Cuvintele legendei de sub tabele, aceleași la Sarcini și la Petiții. */
export function legendaTermen(zileScadent: number, gata: string): { clasa: string; text: string }[] {
  return [
    { clasa: CULORI_TERMEN.restant.bara, text: "restant" },
    { clasa: CULORI_TERMEN.scadent.bara, text: `scadent în ${zileScadent} zile` },
    { clasa: CULORI_TERMEN.inTermen.bara, text: "în termen" },
    { clasa: CULORI_TERMEN.gata.bara, text: gata },
  ];
}
