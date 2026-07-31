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
 */
export function isStale(lastSuccessISO: string | null, today: Date, maxDays = 3): boolean {
  if (!lastSuccessISO) return true;
  return differenceInCalendarDays(today, new Date(lastSuccessISO)) > maxDays;
}
