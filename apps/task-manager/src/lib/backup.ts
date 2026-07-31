import { differenceInCalendarDays, format } from "date-fns";

export interface StoredFile {
  bucket: string;
  name: string;
  size: number;
}

/** Un fișier pe zi pentru baza de date; git le păstrează pe toate. */
export function dumpPath(d: Date): string {
  return `db/${format(d, "yyyy-MM-dd")}.json`;
}

/** Bucketul intră în cale: două buckete pot avea fișiere cu același nume. */
export function filePath(bucket: string, name: string): string {
  return `files/${bucket}/${name}`;
}

const keyOf = (f: StoredFile) => `${f.bucket}/${f.name}/${f.size}`;

/**
 * Ce e în buckete și nu e în manifest.
 *
 * Mărimea intră în cheie, nu doar numele: dacă un fișier a fost înlocuit cu
 * altul sub același nume, manifestul ar spune „salvat" pentru un conținut pe
 * care nu-l are. Scanurile nu se schimbă, dar tăcerea în cazul contrar ar
 * însemna pierdere de date.
 */
export function missingFiles(inBucket: StoredFile[], saved: StoredFile[]): StoredFile[] {
  const have = new Set(saved.map(keyOf));
  return inBucket.filter((f) => !have.has(keyOf(f)));
}

/**
 * A trecut prea mult de la ultima rulare reușită?
 *
 * `null` — nicio reușită vreodată — înseamnă învechit, nu „în regulă până la
 * proba contrarie": exact atunci trebuie să afli.
 *
 * Un timestamp ilizibil primește același răspuns ca `null`, din același motiv:
 * în ambele cazuri lipsește dovada că o copie a reușit. Fără garda de mai jos
 * data invalidă ar da NaN, iar `NaN > maxDays` e false — adică tocmai
 * liniștirea falsă pe care evidența rulărilor există s-o prevină.
 */
export function isStale(lastSuccessISO: string | null, today: Date, maxDays = 3): boolean {
  if (!lastSuccessISO) return true;
  const t = new Date(lastSuccessISO);
  if (Number.isNaN(t.getTime())) return true;
  return differenceInCalendarDays(today, t) > maxDays;
}
