/**
 * Copia zilnică: toată baza de date și fișierele noi, în repo-ul privat.
 *
 * Chemată de cronul Worker-ului (handlerul `scheduled` din `worker.ts`) și de
 * butonul adminului. Pe Vercel era o rută HTTP apărată de `CRON_SECRET`; aici
 * cronul cheamă funcția direct, deci nu există o ușă de apărat și nici secretul.
 *
 * Ce ține designul, în ordinea importanței (neschimbat de pe Vercel):
 *
 * 1. **Fiecare rulare lasă urmă.** Rândul din `backup_runs` se deschide pe eșec
 *    și se închide pe reușită. O rulare omorâtă la mijloc lasă în urmă un eșec,
 *    care e adevărul. O copie care se oprește în tăcere e mai rea decât lipsa
 *    uneia: te crezi acoperit tocmai când nu ești.
 * 2. **Progresul parțial se păstrează.** Dacă al șaptelea fișier din
 *    cincisprezece cade, manifestul tot se scrie cu primele șase. Altfel rularea
 *    de mâine le-ar relua, iar restanța n-ar scădea niciodată.
 * 3. **O restanță nu e un eșec.** Fișierele se iau cu porția; `files_pending`
 *    spune cât a mai rămas. Semnalul de alarmă e restanța care nu scade de la o
 *    zi la alta, nu existența ei.
 *
 * **Modul de probă.** A servit cât timp `sarcini.dumitru.cloud` era încă pe
 * Vercel (până la 24.10.2026), a cărui copie scria în fiecare noapte
 * `db/AAAA-LL-ZZ.json` și `manifest.json`. O copie de pe Worker scrisă în
 * aceleași locuri ar fi înlocuit datele adevărate cu cele din baza de probă.
 * Rămâne pentru o eventuală întoarcere pe Vercel; producția e pe „productie". De aceea `BACKUP_MODE = "proba"` scrie dumpul sub
 * `proba-cloudflare/`, nu urcă fișiere și nu atinge manifestul — doar numără
 * ce ar urca. Cronul nu rulează deloc în probă; doar butonul.
 */

import { desc, eq } from "drizzle-orm";

import type { Db } from "@/lib/db";
import { backupRuns } from "@/lib/db/schema";
import { getFile, putFile } from "@/lib/github";
import { alreadyCovered, dumpPath, filePath, missingFiles, type StoredFile } from "@/lib/backup";
import { buildDump } from "@/lib/backup-dump";

export type BackupMode = "productie" | "proba";

/** Ce citește copia din R2; un `R2Bucket` îl are, iar testele dau unul în memorie. */
export interface FileSource {
  list(options?: { cursor?: string; limit?: number }): Promise<{
    objects: { key: string; size: number }[];
    truncated: boolean;
    cursor?: string;
  }>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

/**
 * Numele „bucketului" din manifest. Fișierele au trecut din Storage în R2 sub
 * aceleași chei, iar manifestul scris pe Vercel le ține sub „petitions" — cu
 * același nume, fișierele deja salvate se recunosc și nu se urcă din nou.
 */
export const FILES_BUCKET = "petitions";

/** Câte fișiere noi se urcă într-o rulare. Restul așteaptă ziua următoare. */
const FILES_PER_RUN = 15;

const MANIFEST = "manifest.json";
const PROBA_PREFIX = "proba-cloudflare/";

/**
 * Cât timp are voie să dureze partea de fișiere, socotit de la începutul
 * rulării. Pe Vercel funcția avea un minut; un cron de Worker are minute
 * întregi, dar pragul rămâne, ca o rulare blocată pe un fișier mare să apuce
 * totuși să scrie manifestul cu ce a reușit.
 */
const FILE_BUDGET_MS = 4 * 60_000;

/**
 * Un mesaj de eroare netăiat poate fi un răspuns HTTP întreg. Rândul din
 * evidență trebuie să spună ce s-a stricat, nu să reproducă tot ce a răspuns
 * serverul — altfel pagina de administrare devine ilizibilă exact în ziua în
 * care ai nevoie de ea.
 */
const MAX_ERROR_CHARS = 2000;

interface Manifest {
  version: number;
  updated_at: string;
  files: StoredFile[];
}

/**
 * Ce s-a apucat să se facă. Se completează pe măsură, nu la final: dacă o
 * etapă aruncă, cifrele de până acolo ajung totuși în evidență și spun unde
 * s-a oprit rularea.
 */
export interface BackupSummary {
  skipped?: boolean;
  ok: boolean;
  mode: BackupMode;
  tables: number;
  rows: number;
  files_uploaded: number;
  files_pending: number;
  error: string | null;
}

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));
const clamp = (text: string) => (text.length > MAX_ERROR_CHARS ? `${text.slice(0, MAX_ERROR_CHARS)}…` : text);

export function backupMode(value: string | undefined): BackupMode {
  return value === "productie" ? "productie" : "proba";
}

async function listFiles(files: FileSource): Promise<StoredFile[]> {
  const found: StoredFile[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await files.list({ cursor, limit: 1000 });
    for (const o of page.objects) found.push({ bucket: FILES_BUCKET, name: o.key, size: o.size });
    if (!page.truncated || !page.cursor) break;
    cursor = page.cursor;
  }
  // Ordonate: „primele FILES_PER_RUN" trebuie să însemne același lucru de la o
  // zi la alta, altfel restanța nu se termină niciodată.
  return found.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function isStoredFile(value: unknown): value is StoredFile {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  return typeof f.bucket === "string" && typeof f.name === "string" && typeof f.size === "number";
}

/**
 * Ce e deja salvat, după manifest. Lipsa lui e cazul obișnuit la prima rulare.
 * Un manifest **existent dar necitibil** oprește rularea: tratat ca listă
 * goală, ar fi suprascris singura evidență a ce s-a copiat până acum.
 */
async function readManifest(): Promise<StoredFile[]> {
  const raw = await getFile(MANIFEST);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error(
      `„${MANIFEST}" există în repo dar nu e JSON valid. Copia s-a oprit ca să nu ` +
        `scrie peste evidența fișierelor deja salvate.`,
    );
  }
  const files =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).files
      : parsed;
  if (!Array.isArray(files)) {
    throw new Error(`„${MANIFEST}" nu conține o listă de fișiere. Copia s-a oprit.`);
  }
  return files.filter(isStoredFile);
}

/**
 * Descarcă din R2 și urcă, unul câte unul, până la limită sau până expiră
 * bugetul. **Nu aruncă**: apelantul trebuie să apuce să scrie manifestul cu ce
 * a reușit. La prima defecțiune se oprește — aproape toate cauzele sunt de
 * sistem (token, limită de cereri, rețea), iar încercările rămase ar fi degeaba.
 */
async function uploadFiles(
  files: FileSource,
  missing: StoredFile[],
  deadline: number,
): Promise<{ uploaded: StoredFile[]; error: string | null }> {
  const uploaded: StoredFile[] = [];
  for (const file of missing.slice(0, FILES_PER_RUN)) {
    if (Date.now() > deadline) break;
    try {
      const object = await files.get(file.name);
      if (!object) return { uploaded, error: `„${file.name}" a dispărut din R2 între listare și copiere.` };
      // Un singur fișier în memorie odată.
      const content = Buffer.from(await object.arrayBuffer());
      const written = await putFile(filePath(file.bucket, file.name), content, `backup: ${file.bucket}/${file.name}`);
      if (!written.ok) return { uploaded, error: written.error };
      uploaded.push(file);
    } catch (err) {
      return { uploaded, error: `Copierea „${file.bucket}/${file.name}" a eșuat: ${reason(err)}` };
    }
  }
  return { uploaded, error: null };
}

async function runBackup(
  db: Db,
  files: FileSource,
  mode: BackupMode,
  progress: BackupSummary,
  deadline: number,
): Promise<void> {
  // Un singur moment pentru toată rularea: altfel o copie pornită la 23:59:59
  // ar putea scrie `exported_at` dintr-o zi și numele fișierului din alta.
  const now = new Date();
  const json = await buildDump(db, now, (tables, rows) => {
    progress.tables = tables;
    progress.rows = rows;
  });

  const prefix = mode === "proba" ? PROBA_PREFIX : "";
  const dump = await putFile(
    `${prefix}${dumpPath(now)}`,
    Buffer.from(json, "utf8"),
    `backup${mode === "proba" ? " (probă Cloudflare)" : ""}: baza de date ${now.toISOString().slice(0, 10)}`,
  );
  if (!dump.ok) throw new Error(dump.error);

  const saved = await readManifest();
  const missing = missingFiles(await listFiles(files), saved);

  if (mode === "proba") {
    // În probă doar se numără: urcarea ar atinge manifestul de pe Vercel.
    progress.files_pending = missing.length;
    return;
  }

  const { uploaded, error } = await uploadFiles(files, missing, deadline);
  progress.files_uploaded = uploaded.length;
  progress.files_pending = missing.length - uploaded.length;

  // Manifestul se scrie **înainte** de a arunca eroarea buclei: dacă au reușit
  // șase fișiere din cincisprezece, cele șase trebuie să rămână înregistrate.
  if (uploaded.length > 0) {
    const next: Manifest = { version: 1, updated_at: new Date().toISOString(), files: [...saved, ...uploaded] };
    const written = await putFile(
      MANIFEST,
      Buffer.from(`${JSON.stringify(next, null, 2)}\n`, "utf8"),
      `backup: manifest (+${uploaded.length})`,
    );
    if (!written.ok) {
      // Fișierele sunt în repo, dar neînregistrate — mâine se reiau. Rularea
      // trebuie să iasă pe eșec, nu pe reușită tăcută.
      const alsoFailed = error ? ` Bucla de fișiere se oprise deja: ${error}` : "";
      throw new Error(
        `Fișierele s-au urcat, dar „${MANIFEST}" n-a putut fi actualizat, deci ` +
          `rularea următoare le va relua. ${written.error}${alsoFailed}`,
      );
    }
  }
  if (error) throw new Error(error);
}

/**
 * O rulare întreagă: verifică dacă ziua e deja acoperită, deschide rândul în
 * `backup_runs`, face copia, închide rândul. `force` sare peste verificarea
 * zilei acoperite — butonul adminului e o cerere explicită, nu plasa de noapte.
 */
export async function runNightlyBackup(opts: {
  db: Db;
  files: FileSource;
  mode: BackupMode;
  force?: boolean;
}): Promise<BackupSummary> {
  const { db, files, mode } = opts;
  const deadline = Date.now() + FILE_BUDGET_MS;
  const summary: BackupSummary = {
    ok: false,
    mode,
    tables: 0,
    rows: 0,
    files_uploaded: 0,
    files_pending: 0,
    error: null,
  };

  // Noaptea se rulează de două ori, ca o rulare întreruptă să nu însemne o zi
  // neacoperită. Dacă prima a reușit, a doua n-are ce face — și iese înainte de
  // a deschide rândul, ca panoul să nu se umple cu rulări fără lucru.
  if (!opts.force) {
    const lastOk = await db
      .select({ started_at: backupRuns.started_at })
      .from(backupRuns)
      .where(eq(backupRuns.ok, true))
      .orderBy(desc(backupRuns.started_at))
      .limit(1)
      .get();
    if (alreadyCovered(lastOk?.started_at ?? null, new Date())) {
      return { ...summary, skipped: true, ok: true };
    }
  }

  // Rândul se deschide pe `ok = false` și rămâne așa dacă rularea e omorâtă.
  const runId = crypto.randomUUID();
  await db.insert(backupRuns).values({ id: runId, ok: false, started_at: new Date().toISOString() });

  try {
    await runBackup(db, files, mode, summary, deadline);
  } catch (err) {
    summary.error = clamp(reason(err));
  }
  summary.ok = summary.error === null;

  try {
    await db
      .update(backupRuns)
      .set({
        finished_at: new Date().toISOString(),
        ok: summary.ok,
        tables_count: summary.tables,
        rows_count: summary.rows,
        files_uploaded: summary.files_uploaded,
        files_pending: summary.files_pending,
        error: summary.error,
      })
      .where(eq(backupRuns.id, runId));
  } catch (err) {
    // Rândul a rămas deschis, deci evidența spune „eșec". Rezultatul spune la
    // fel, cu motivul — altfel jurnalul ar arăta o reușită și pagina un eșec.
    const notClosed = `Rândul rulării n-a putut fi închis: ${reason(err)}.`;
    summary.error = summary.error ? `${summary.error} ${notClosed}` : notClosed;
    summary.ok = false;
  }
  return summary;
}
