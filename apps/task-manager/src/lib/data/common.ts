/**
 * Ce împart modulele de date: forma rezultatului și numele oamenilor.
 *
 * Un modul de date (`lib/data/*.ts`) primește baza și pe cel care acționează
 * ca parametri, deci nu știe de Next, de cookie-uri sau de `revalidatePath`.
 * Acțiunile de server din `app/**` doar îl leagă de cerere. Așa fiecare regulă
 * de drept se testează pe un D1 adevărat, cu un om care are dreptul și cu unul
 * care nu-l are.
 */

import { inArray } from "drizzle-orm";

import type { Db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { auditDupaSchimbare, type AuditContext, type AuditDraft, type NameOf } from "@/lib/audit";

export type ActionResult = { error?: string; success?: boolean };

/**
 * Numele profilurilor date, pentru `assignee_from`/`assignee_to` din jurnal —
 * ce citea triggerul cu `select full_name from profiles where id = …`.
 */
export async function namesOf(db: Db, ids: unknown[]): Promise<NameOf> {
  const wanted = [...new Set(ids.filter((x): x is string => typeof x === "string"))];
  const rows = wanted.length
    ? await db
        .select({ id: profiles.id, full_name: profiles.full_name })
        .from(profiles)
        .where(inArray(profiles.id, wanted))
    : [];
  const map = new Map(rows.map((r) => [r.id, r.full_name]));
  return (id) => (typeof id === "string" ? (map.get(id) ?? null) : null);
}

type Statement = Parameters<Db["batch"]>[0][number];

/**
 * Scrierile unei acțiuni, toate sau niciuna: un singur `batch` D1 e o singură
 * tranzacție. Așa schimbarea și rândul ei din jurnal nu se pot despărți.
 */
export async function runBatch(db: Db, statements: (Statement | Statement[])[]): Promise<void> {
  // `auditInsert` poate întoarce mai multe instrucțiuni; aici se aplatizează.
  const toate = statements.flat();
  if (toate.length === 0) return;
  await db.batch(toate as [Statement, ...Statement[]]);
}

export const RAND_DISPARUT = "Înregistrarea nu mai există: probabil a fost ștearsă între timp. Reîncarcă pagina.";

/** Câte rânduri a atins o instrucțiune `UPDATE`/`DELETE` dintr-un lot D1. */
function randuriAtinse(rezultat: unknown): number {
  return (rezultat as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 0;
}

/**
 * O modificare a unui rând deja citit, cu jurnalul ei, toate sau niciuna.
 *
 * Întoarce `false` când rândul a dispărut între citire și scriere (l-a șters
 * altcineva în aceeași clipă). Atunci nici jurnalul nu se scrie, iar acțiunea
 * spune asta, în loc de un „salvat" despre nimic.
 */
export async function modificaCuJurnal(
  db: Db,
  modificare: Statement,
  ctx: AuditContext,
  drafts: AuditDraft[],
): Promise<boolean> {
  const [rezultat] = await db.batch([modificare, ...auditDupaSchimbare(db, ctx, drafts)]);
  return randuriAtinse(rezultat) > 0;
}
