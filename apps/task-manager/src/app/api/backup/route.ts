/**
 * Copia zilnică: toată baza de date și fișierele noi, într-un repo privat.
 *
 * Chemată de Vercel Cron o dată pe noapte. Citește cu cheia de serviciu, deci
 * vede tot indiferent de RLS, și scrie prin Contents API.
 *
 * Ce ține designul, în ordinea importanței:
 *
 * 1. **Fiecare rulare lasă urmă.** Rândul din `backup_runs` se deschide pe eșec
 *    și se închide pe reușită. O funcție omorâtă la mijloc lasă în urmă un eșec,
 *    care e adevărul. O copie care se oprește în tăcere e mai rea decât lipsa
 *    uneia: te crezi acoperit tocmai când nu ești.
 * 2. **Progresul parțial se păstrează.** Dacă al șaptelea fișier din
 *    cincisprezece cade, manifestul tot se scrie cu primele șase. Altfel rularea
 *    de mâine le-ar relua, iar restanța n-ar scădea niciodată.
 * 3. **O restanță nu e un eșec.** Fișierele se iau cu porția; `files_pending`
 *    spune cât a mai rămas. Semnalul de alarmă e restanța care nu scade de la o
 *    zi la alta, nu existența ei.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getFile, putFile } from "@/lib/github";
import { dumpPath, filePath, missingFiles, type StoredFile } from "@/lib/backup";
import { buildDump } from "@/lib/backup-dump";

export const dynamic = "force-dynamic";
// Un minut: descărcarea și urcarea fișierelor sunt lente. Limita de fișiere pe
// rulare (mai jos) ține rularea sub prag.
export const maxDuration = 60;

type Client = ReturnType<typeof createAdminClient>;

const BUCKETS = ["petitions", "statistics"] as const;

/** Câte fișiere noi se urcă într-o rulare. Restul așteaptă ziua următoare. */
const FILES_PER_RUN = 15;

const MANIFEST = "manifest.json";

/** Intrări pe pagină la listarea unui bucket (`list` dă 100 implicit). */
const LIST_PER_PAGE = 100;

/**
 * Cât timp are voie să dureze partea de fișiere.
 *
 * Nu e o dublură a lui `FILES_PER_RUN`, ci plasa de sub el. Cincisprezece
 * fișiere de câte 10 MB — maximul bucketului — nu se descarcă și nu se urcă
 * într-un minut. Fără pragul ăsta funcția ar fi omorâtă *înainte* de scrierea
 * manifestului, iar munca rulării s-ar pierde întreagă: fișierele ar fi în
 * repo, dar neînregistrate, deci mâine reluate. Restanța n-ar scădea niciodată.
 *
 * Așa, la 40 de secunde nu se mai începe un fișier nou și rămân douăzeci pentru
 * manifest și închiderea rulării. Ce n-a apucat intră în `files_pending`.
 *
 * Se măsoară de la **începutul cererii**, nu de la începutul părții de fișiere:
 * pragul de un minut e al funcției întregi, deci citirea bazei consumă din
 * același buget. Dacă dumpul ia 25 de secunde, fișierelor le rămân 15.
 */
const FILE_BUDGET_MS = 40_000;

/** Marcajul pe care Storage îl pune într-un folder gol; nu e un fișier real. */
const EMPTY_FOLDER = ".emptyFolderPlaceholder";

/** Mesajele lungi ar umfla dumpul de mâine, care conține și `backup_runs`. */
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
interface Progress {
  tables: number;
  rows: number;
  uploaded: number;
  pending: number;
  error: string | null;
}

/** Orice poate fi aruncat, nu doar `Error`. */
function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function clamp(text: string): string {
  return text.length > MAX_ERROR_CHARS ? `${text.slice(0, MAX_ERROR_CHARS)}…` : text;
}

/* -------------------------------------------------------------------------- */
/* Poarta                                                                     */
/* -------------------------------------------------------------------------- */

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // `timingSafeEqual` cere lungimi egale. Compararea lor separat nu scurge
  // nimic folositor: lungimea antetului o alege oricum cel care sună.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Cererea are voie să pornească o copie? `null` înseamnă da.
 *
 * Secretul lipsă din mediu nu e „merge și fără": ruta citește toată baza cu
 * cheia de serviciu, deci neprotejată ar fi o portiță prin care oricine scoate
 * datele. De aceea 500, nu rulare.
 */
function checkSecret(request: Request): NextResponse | null {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET nu e configurat, deci ruta ar rula neprotejată. " +
          "Se setează în Vercel → Settings → Environment Variables.",
      },
      { status: 500 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  if (!sameSecret(header, `Bearer ${secret}`)) {
    // Fără detalii: un mesaj care spune ce anume n-a corespuns ajută doar pe
    // cine încearcă să ghicească.
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Fișierele                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Tot ce e într-un bucket, coborând prin foldere.
 *
 * `list` întoarce un singur nivel, iar folderele vin ca intrări fără `id` și
 * fără `metadata`. Atașamentele petițiilor stau în câte un folder pe petiție,
 * deci o listare neriecursivă ar găsi numai nume de foldere și niciun fișier —
 * și ar raporta liniștită că n-are nimic de salvat.
 *
 * Sortarea e cerută explicit fiindcă paginarea prin `offset` are nevoie de o
 * ordine stabilă, iar „primele `FILES_PER_RUN`" trebuie să însemne același
 * lucru de la o zi la alta, altfel restanța nu se termină niciodată.
 */
async function listBucket(supabase: Client, bucket: string): Promise<StoredFile[]> {
  const found: StoredFile[] = [];

  const walk = async (prefix: string): Promise<void> => {
    for (let offset = 0; ; ) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: LIST_PER_PAGE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new Error(`Listarea bucketului „${bucket}" a eșuat: ${error.message}`);
      }

      const entries = data ?? [];
      if (entries.length === 0) return;

      for (const entry of entries) {
        if (entry.name === EMPTY_FOLDER) continue;

        if (entry.id === null) {
          await walk(`${prefix}${entry.name}/`);
          continue;
        }

        found.push({
          bucket,
          name: `${prefix}${entry.name}`,
          size: entry.metadata?.size ?? 0,
        });
      }

      offset += entries.length;
    }
  };

  await walk("");
  return found;
}

function isStoredFile(value: unknown): value is StoredFile {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  return typeof f.bucket === "string" && typeof f.name === "string" && typeof f.size === "number";
}

/**
 * Ce e deja salvat, după manifest.
 *
 * Lipsa lui e cazul obișnuit la prima rulare — listă goală, se copiază tot.
 *
 * Un manifest **existent dar necitibil** e altceva și se oprește aici cu
 * eroare. Tentația e să-l tratezi tot ca listă goală, dar asta ar suprascrie
 * singura evidență a ce s-a copiat până acum cu una pornită de la zero: o
 * stricăciune făcută ca răspuns la o stricăciune, în tăcere.
 *
 * O intrare stricată dintr-o listă altfel bună se ignoră, însă: fișierul ei
 * ajunge să pară nesalvat și se urcă din nou, ceea ce e inofensiv — scrierea
 * peste același conținut nu strică nimic — și repară manifestul de la sine.
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
        `scrie peste evidența fișierelor deja salvate. Repară-l sau șterge-l din repo ` +
        `(dacă îl ștergi, fișierele se vor urca din nou).`,
    );
  }

  const files =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).files
      : parsed;

  if (!Array.isArray(files)) {
    throw new Error(
      `„${MANIFEST}" nu conține o listă de fișiere. Copia s-a oprit ca să nu scrie ` +
        `peste evidența fișierelor deja salvate.`,
    );
  }

  return files.filter(isStoredFile);
}

/**
 * Descarcă și urcă, unul câte unul, până la limită sau până expiră bugetul.
 *
 * **Nu aruncă niciodată.** Orice defecțiune oprește bucla și se întoarce ca
 * text, fiindcă apelantul trebuie să apuce să scrie manifestul cu ce a reușit.
 * O aruncare de aici ar sări peste scriere și ar pierde tocmai progresul
 * parțial pe care bucla l-a făcut.
 *
 * La prima defecțiune se oprește, nu se trece la fișierul următor: aproape
 * toate cauzele sunt de sistem — token, limită de cereri, rețea — iar
 * încercările rămase ar consuma degeaba minutul. Un fișier care ar cădea singur
 * de fiecare dată ar bloca coada, dar asta se vede: restanța nu mai scade.
 */
async function uploadFiles(
  supabase: Client,
  missing: StoredFile[],
  deadline: number,
): Promise<{ uploaded: StoredFile[]; error: string | null }> {
  const uploaded: StoredFile[] = [];

  for (const file of missing.slice(0, FILES_PER_RUN)) {
    if (Date.now() > deadline) break;

    try {
      const { data, error } = await supabase.storage.from(file.bucket).download(file.name);
      if (error || !data) {
        return {
          uploaded,
          error: `Descărcarea „${file.bucket}/${file.name}" din Storage a eșuat: ${
            error?.message ?? "răspuns gol"
          }`,
        };
      }

      // Un singur fișier în memorie odată: `content` se rescrie la fiecare pas,
      // iar în `uploaded` rămân doar numele și mărimile. Cincisprezece scanuri
      // ținute laolaltă ar putea trece de memoria funcției.
      const content = Buffer.from(await data.arrayBuffer());
      const written = await putFile(
        filePath(file.bucket, file.name),
        content,
        `backup: ${file.bucket}/${file.name}`,
      );
      if (!written.ok) return { uploaded, error: written.error };

      uploaded.push(file);
    } catch (err) {
      return {
        uploaded,
        error: `Copierea „${file.bucket}/${file.name}" a eșuat: ${reason(err)}`,
      };
    }
  }

  return { uploaded, error: null };
}

/* -------------------------------------------------------------------------- */
/* Rularea                                                                    */
/* -------------------------------------------------------------------------- */

async function runBackup(
  supabase: Client,
  progress: Progress,
  deadline: number,
): Promise<void> {
  // Un singur moment pentru toată rularea: altfel o copie pornită la 23:59:59
  // ar putea scrie `exported_at` dintr-o zi și numele fișierului din alta.
  const now = new Date();
  const json = await buildDump(supabase, now, (tables, rows) => {
    progress.tables = tables;
    progress.rows = rows;
  });

  const dump = await putFile(
    dumpPath(now),
    Buffer.from(json, "utf8"),
    `backup: baza de date ${now.toISOString().slice(0, 10)}`,
  );
  if (!dump.ok) throw new Error(dump.error);

  const saved = await readManifest();

  const inBuckets: StoredFile[] = [];
  for (const bucket of BUCKETS) {
    inBuckets.push(...(await listBucket(supabase, bucket)));
  }

  const missing = missingFiles(inBuckets, saved);
  const { uploaded, error } = await uploadFiles(supabase, missing, deadline);

  progress.uploaded = uploaded.length;
  progress.pending = missing.length - uploaded.length;

  // Manifestul se scrie **înainte** de a arunca eroarea buclei: dacă au reușit
  // șase fișiere din cincisprezece, cele șase trebuie să rămână înregistrate.
  // Altfel rularea de mâine le-ar relua, iar restanța n-ar scădea niciodată.
  if (uploaded.length > 0) {
    const next: Manifest = {
      version: 1,
      updated_at: new Date().toISOString(),
      files: [...saved, ...uploaded],
    };
    const written = await putFile(
      MANIFEST,
      Buffer.from(`${JSON.stringify(next, null, 2)}\n`, "utf8"),
      `backup: manifest (+${uploaded.length})`,
    );
    if (!written.ok) {
      // Fișierele sunt în repo, dar neînregistrate — mâine se reiau. Nu e
      // pierdere de date, e muncă irosită la nesfârșit dacă se repetă, deci
      // rularea trebuie să iasă pe eșec, nu pe reușită tăcută.
      //
      // Dacă și bucla căzuse, motivul ei se păstrează alături: de obicei
      // amândouă vin din aceeași cauză, dar nu întotdeauna — o descărcare
      // căzută din Storage și o scriere refuzată de GitHub sunt lucruri
      // diferite, iar cel care caută pricina are nevoie de amândouă.
      const alsoFailed = error ? ` Bucla de fișiere se oprise deja: ${error}` : "";
      throw new Error(
        `Fișierele s-au urcat, dar „${MANIFEST}" n-a putut fi actualizat, deci ` +
          `rularea următoare le va relua. ${written.error}${alsoFailed}`,
      );
    }
  }

  if (error) throw new Error(error);
}

async function closeRun(supabase: Client, runId: string, progress: Progress): Promise<void> {
  await supabase
    .from("backup_runs")
    .update({
      finished_at: new Date().toISOString(),
      ok: progress.error === null,
      tables_count: progress.tables,
      rows_count: progress.rows,
      files_uploaded: progress.uploaded,
      files_pending: progress.pending,
      error: progress.error,
    })
    .eq("id", runId);
}

export async function GET(request: Request) {
  const denied = checkSecret(request);
  if (denied) return denied;

  const deadline = Date.now() + FILE_BUDGET_MS;
  const supabase = createAdminClient();

  // Rândul se deschide pe `ok = false` și rămâne așa dacă funcția e omorâtă la
  // mijloc. Nu e o scăpare, e felul în care se află: o rulare care n-a apucat
  // să se închidă n-a reușit.
  const opened = await supabase.from("backup_runs").insert({ ok: false }).select("id").single();
  if (opened.error || !opened.data) {
    // Fără rând nu există unde scrie motivul; singurul loc rămas e răspunsul,
    // pe care Vercel îl păstrează în jurnalul cronului.
    return NextResponse.json(
      {
        error: `Evidența rulărilor n-a putut fi deschisă: ${
          opened.error?.message ?? "răspuns gol"
        }. Verifică dacă migrarea 0022 a fost rulată.`,
      },
      { status: 500 },
    );
  }

  const runId = String(opened.data.id);
  const progress: Progress = { tables: 0, rows: 0, uploaded: 0, pending: 0, error: null };

  try {
    await runBackup(supabase, progress, deadline);
  } catch (err) {
    progress.error = clamp(reason(err));
  }

  await closeRun(supabase, runId, progress);

  // O restanță de fișiere e reușită, nu eșec: `files_pending` spune cât a mai
  // rămas, iar backfill-ul se întinde peste câteva zile prin construcție.
  return NextResponse.json(
    {
      ok: progress.error === null,
      tables: progress.tables,
      rows: progress.rows,
      files_uploaded: progress.uploaded,
      files_pending: progress.pending,
      error: progress.error,
    },
    { status: progress.error === null ? 200 : 500 },
  );
}
