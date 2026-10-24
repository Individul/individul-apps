/**
 * Dumpul bazei de date: toate tabelele, într-un singur format.
 *
 * Stă aici, nu în rute, fiindcă îl folosesc amândouă copiile — cea zilnică
 * (cronul Worker-ului) și cea manuală (butonul adminului). Butonul a salvat ani
 * la rând cinci tabele din cincisprezece tocmai fiindcă avea lista lui, pe care
 * nimeni n-a mai atins-o când au apărut petițiile, ședințele și transferurile.
 * Un admin care-l apăsa credea că are tot; avea sarcinile. A doua listă
 * înseamnă că se repetă, deci nu există a doua listă.
 *
 * Citește din D1 prin Drizzle, deci valorile ies cu tipul lor — `true`/`false`,
 * jurnalul ca obiect —, ca în dumpurile scrise pe vremea Supabase. Dreptul de
 * a cere dumpul îl verifică cine cheamă (adminul sau cronul).
 */

import { asc, getTableColumns, getTableName, is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";

import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

type Row = Record<string, unknown>;

export interface BackupTable {
  name: string;
  /** Coloanele după care se ordonează, în ordinea aplicării. */
  order: readonly [string, ...string[]];
}

/**
 * Tabelele din copie și coloanele după care se ordonează.
 *
 * Lista trebuie să le cuprindă pe **toate** tabelele din `lib/db/schema.ts`,
 * afară de cele scrise anume în test (`backup_runs`, conturile și sesiunile).
 * Nu e o rugăminte: testul citește schema și compară, deci un tabel nou uitat
 * aici pică la `npm test`, nu peste un an, când s-ar căuta în copie.
 *
 * Tabelele `stat_*` nu mai sunt: statisticile au plecat în aplicația lor, iar
 * datele lor rămân în dumpurile scrise înainte de mutarea pe Cloudflare.
 *
 * **Ordinea tabelelor** urmează cheile străine: părintele înaintea copilului
 * (`profiles` înaintea lui `tasks`, `petitions` înaintea atașamentelor). Dumpul
 * iese la fel oricum, dar la restaurare fișierul se citește de sus în jos, iar
 * o ordine greșită ar cere rânduri care încă n-au fost inserate.
 *
 * **Ordinea rândurilor** dintr-un tabel trebuie să fie **totală**, nu doar
 * „stabilă la prima vedere", din două motive care se sprijină unul pe altul:
 *
 * - citirea se face paginat (vezi `readTable`), iar paginarea peste o ordine cu
 *   egalități poate sări rânduri sau le poate lua de două ori — adică exact
 *   pierderea tăcută pe care copia există s-o prevină;
 * - fără egalități, dumpul de mâine iese la fel cu cel de azi acolo unde datele
 *   n-au fost atinse, deci git comprimă bine fișierele zilnice între ele.
 *   Mărimea repo-ului e un risc asumat în design.
 *
 * De aceea fiecare listă se termină cu o coloană unică. `created_at` singur nu
 * ajunge: două rânduri scrise în aceeași tranzacție au aceeași valoare, iar la
 * egalitate Postgres nu garantează nicio ordine.
 *
 * Se începe cu coloana „naturală" (data, poziția) tocmai ca rândurile noi să
 * cadă la coadă, nu împrăștiate prin fișier.
 */
export const BACKUP_TABLES: readonly BackupTable[] = [
  { name: "profiles", order: ["created_at", "id"] },
  { name: "tasks", order: ["created_at", "id"] },
  { name: "subtasks", order: ["task_id", "position", "id"] },
  { name: "comments", order: ["created_at", "id"] },
  { name: "tags", order: ["name", "id"] },
  // Singurul tabel fără `id`: cheia primară e perechea (task_id, tag_id).
  { name: "task_tags", order: ["task_id", "tag_id"] },
  { name: "petitions", order: ["created_at", "id"] },
  { name: "petition_attachments", order: ["created_at", "id"] },
  { name: "hearings", order: ["session_date", "id"] },
  { name: "transfers", order: ["transfer_date", "id"] },
  { name: "transfer_plans", order: ["hearing_date", "id"] },
  { name: "obligations", order: ["position", "id"] },
  { name: "obligation_completions", order: ["due_date", "id"] },
  { name: "defendants", order: ["last_name", "id"] },
  { name: "contraveners", order: ["decision_date", "id"] },
  { name: "releases", order: ["release_date", "id"] },
  { name: "notifications", order: ["created_at", "id"] },
  { name: "audit_log", order: ["created_at", "id"] },
];

/**
 * Versiunea formatului scris de aici.
 *
 * 1 era vechiul fișier al butonului, cu cinci tabele. 2 le are pe toate. Numărul
 * e singurul semn după care cineva — om sau cod — deosebește un fișier complet
 * de unul parțial, la un an după ce l-a descărcat.
 */
export const DUMP_VERSION = 2;

/** Rânduri pe pagină la citirea unui tabel. */
const ROWS_PER_PAGE = 1000;

/** Tabelele schemei după numele lor din bază. */
const TABLES_BY_NAME = new Map<string, SQLiteTable>(
  (Object.values(schema) as unknown[])
    .filter((t): t is SQLiteTable => is(t, SQLiteTable))
    .map((t) => [getTableName(t), t]),
);

/**
 * Un tabel întreg, citit paginat.
 *
 * Paginat ca pe vremea PostgREST, deși D1 n-are plafonul lui `max_rows`: o
 * citire dintr-o bucată a unui tabel care crește ani la rând ar ține tot
 * răspunsul în memorie deodată. Paginarea are nevoie de ordinea totală de mai
 * sus — peste o ordine cu egalități ar putea sări sau dubla rânduri.
 */
async function readTable(db: Db, name: string, order: readonly [string, ...string[]]): Promise<Row[]> {
  const table = TABLES_BY_NAME.get(name);
  if (!table) throw new Error(`Tabelul „${name}" nu există în schemă.`);
  const columns = getTableColumns(table);
  const orderBy = order.map((c) => {
    const column = Object.values(columns).find((col) => col.name === c);
    if (!column) throw new Error(`Coloana „${name}.${c}" nu există în schemă.`);
    return asc(column);
  });

  const rows: Row[] = [];
  for (let offset = 0; ; offset += ROWS_PER_PAGE) {
    const batch = (await db
      .select()
      .from(table)
      .orderBy(...orderBy)
      .limit(ROWS_PER_PAGE)
      .offset(offset)) as Row[];
    if (batch.length === 0) return rows;
    rows.push(...batch);
  }
}

/**
 * Dumpul complet, gata de scris pe disc sau de trimis la descărcare.
 *
 * Întoarce textul, nu obiectul, tocmai ca fișierul zilnic și cel descărcat de
 * admin să iasă identice până la ultimul spațiu: dacă fiecare rută și-ar face
 * propriul `JSON.stringify`, indentarea ar putea să difere, iar procedura de
 * restaurare ar avea de-a face cu două formate în loc de unul.
 *
 * `onTable` se cheamă după fiecare tabel citit, cu totalurile de până acolo.
 * Cronul le trece în evidența rulărilor pe măsură, nu la final: dacă al
 * treisprezecelea tabel aruncă, cifrele primelor douăsprezece spun unde s-a
 * oprit. Fără ele ar rămâne un eșec fără urmă.
 */
export async function buildDump(
  db: Db,
  now: Date,
  onTable?: (tables: number, rows: number) => void,
): Promise<string> {
  const data: Record<string, Row[]> = {};
  const counts: Record<string, number> = {};
  let rows = 0;

  // Secvențial, nu în paralel: cincisprezece bucle de paginare pornite deodată
  // ar ține în memorie cincisprezece tabele pe jumătate citite, iar dumpul e
  // oricum ieftin — câțiva megabiți de text.
  for (const [index, table] of BACKUP_TABLES.entries()) {
    const read = await readTable(db, table.name, table.order);
    data[table.name] = read;
    counts[table.name] = read.length;
    rows += read.length;

    onTable?.(index + 1, rows);
  }

  const dump = {
    app: "task-manager",
    version: DUMP_VERSION,
    exported_at: now.toISOString(),
    counts,
    data,
  };

  // Cu indentare: git comprimă mai bine text aerisit decât o linie uriașă, iar
  // la o restaurare fișierul trebuie să poată fi citit de om.
  return `${JSON.stringify(dump, null, 2)}\n`;
}
