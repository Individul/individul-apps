/**
 * Care articol se aplică la a doua sentință: art. 84 alin. (4) sau art. 85.
 *
 * Cele două se citesc ușor greșit fiindcă amândouă vorbesc despre un om care
 * are deja o sentință și mai primește una. Ce le desparte nu e scris nicăieri
 * ca regulă, ci iese din câte un cuvânt al fiecăruia:
 *
 *  — art. 84 alin. (4): „...vinovată şi de comiterea unei alte infracţiuni
 *    săvârșite ÎNAINTE de pronunţarea sentinţei în prima cauză";
 *  — art. 85 alin. (1): „...DUPĂ pronunțarea sentinței, dar înainte de
 *    executarea completă a pedepsei, condamnatul a săvârșit o nouă infracțiune".
 *
 * Deci hotărăște data săvârșirii față de data pronunțării, nu gravitatea, nu
 * ordinea în care au venit sentințele și nici când s-a descoperit fapta.
 *
 * Urmările sunt deosebite, de aceea alegerea contează: la art. 84 durata deja
 * executată INTRĂ în termenul definitiv, la art. 85 partea neexecutată SE ADAUGĂ
 * la pedeapsa nouă. Plafoanele sunt și ele altele.
 */

export type Temei = "art84" | "art85" | "niciunul";

export interface DateCumul {
  /** Când a fost săvârșită fapta pentru care vine a doua sentință. */
  savarsire: Date;
  /** Când s-a pronunțat sentința în prima cauză. */
  pronuntare: Date;
  /**
   * Când s-a încheiat executarea primei pedepse. Poate lipsi — atunci art. 85
   * se dă sub condiția că pedeapsa nu era executată integral.
   */
  sfarsitPrimei?: Date | null;
}

export interface RezultatCumul {
  temei: Temei;
  /**
   * Fapta e săvârșită chiar în ziua pronunțării. Data singură nu spune dacă a
   * fost înainte sau după citirea sentinței, deci răspunsul trebuie privit cu
   * ora în față.
   */
  aceeasiZi: boolean;
}

/** Ziua calendaristică, la amiază: ora din date nu trebuie să hotărască nimic. */
function zi(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
}

/**
 * Temeiul aplicabil.
 *
 * `niciunul` nu e un eșec al socotelii, ci un răspuns: dacă fapta e săvârșită
 * după ce pedeapsa fusese executată integral, nu mai e nici concurs, nici cumul
 * — e o cauză de sine stătătoare. Art. 85 cere anume ca fapta să fie săvârșită
 * „înainte de executarea completă a pedepsei".
 */
export function temeiCumul({ savarsire, pronuntare, sfarsitPrimei }: DateCumul): RezultatCumul {
  const s = zi(savarsire);
  const p = zi(pronuntare);

  if (s < p) return { temei: "art84", aceeasiZi: false };

  const aceeasiZi = s === p;

  // Ultima zi de executare se socotește executată în întregime abia la
  // sfârșitul ei, deci o faptă săvârșită chiar atunci e încă „înainte de
  // executarea completă".
  if (sfarsitPrimei && s > zi(sfarsitPrimei)) {
    return { temei: "niciunul", aceeasiZi };
  }

  return { temei: "art85", aceeasiZi };
}
