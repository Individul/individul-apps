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
 * De ce refuză restaurarea automată fișierul? `null` înseamnă că-l acceptă.
 *
 * Butonul de restaurare știe patru tabele — sarcini, etichete, legături,
 * comentarii — adică formatul vechi (`version: 1`). Copiile de azi au
 * cincisprezece tabele și scriu `version: 2`.
 *
 * Refuzul e intenționat, nu o lipsă de timp. Un import parțial peste o bază de
 * date reală e mai periculos decât lipsa butonului: ordinea inserărilor
 * contează (profilurile înaintea sarcinilor, petițiile înaintea atașamentelor),
 * iar cine apasă e, de obicei, un om speriat care tocmai a pierdut ceva. O
 * restaurare se face o dată la câțiva ani, cu capul limpede, după procedura din
 * README — nu în panică, dintr-un buton care ia jumătate din date.
 *
 * De aceea refuzul e explicit: mai bine „nu pot" decât o reușită care lasă
 * treisprezece tabele afară fără să spună.
 */
export function restoreRefusal(payload: unknown): string | null {
  // `Number` prinde și „2" scris ca text; lipsa câmpului dă NaN, deci fișierele
  // vechi trec mai departe la validarea de conținut, ca înainte.
  const version = Number((payload as { version?: unknown } | null)?.version);
  if (!Number.isFinite(version) || version <= 1) return null;

  return (
    `Fișierul e în formatul complet (versiunea ${version}, toate tabelele). ` +
    `Restaurarea automată acoperă doar formatul vechi — vezi README pentru ` +
    `procedura de restaurare completă.`
  );
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
