// Șabloane de pași pentru etichetele-categorie. Cheile sunt normalizate
// (litere mici, fără diacritice) ca să se potrivească indiferent de scriere.

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const DEMERS = ["Demers întocmit", "Demers expediat la instanță", "Demers examinat de instanță"];

const TEMPLATES: Record<string, string[]> = {
  cumulare: DEMERS,
  "arest preventiv": DEMERS,
  neclaritati: DEMERS,
  "solicitare hotariri": ["Solicitare întocmită", "Solicitare expediată", "Hotărâre primită"],
};

// Un pas de „expediere" (demers/solicitare expediat/ă) — bifarea lui avansează
// sarcina de la „De făcut" la „În lucru".
export function isDispatchStep(title: string): boolean {
  return norm(title).includes("expediat");
}

// Pașii standard (fără duplicate) pentru un set de nume de etichete.
export function templateStepsForTags(tagNames: string[]): string[] {
  const steps: string[] = [];
  for (const name of tagNames) {
    const t = TEMPLATES[norm(name)];
    if (t) for (const s of t) if (!steps.includes(s)) steps.push(s);
  }
  return steps;
}
