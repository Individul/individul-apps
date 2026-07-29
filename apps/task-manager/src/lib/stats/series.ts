/**
 * Un indicator merită afișat doar dacă a avut măcar o dată o valoare diferită
 * de zero. Cei care sunt 0 în toate perioadele (sau nu au deloc valori) sunt
 * zgomot: rapoartele conțin zeci de rânduri care nu s-au întâmplat niciodată.
 *
 * Atenție: „diferit de zero" include și negativele — suprapopularea poate fi
 * -5, iar acela e un indicator foarte relevant.
 *
 * Filtrarea se face doar la afișare. Valorile rămân salvate, ca să se poată
 * distinge oricând „raportat 0" de „nu s-a raportat".
 */
export function hasMeaningfulValue(values: (number | null | undefined)[]): boolean {
  return values.some((v) => typeof v === "number" && v !== 0);
}
