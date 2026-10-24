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
import type { NameOf } from "@/lib/audit";

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
export async function runBatch(db: Db, statements: Statement[]): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(statements as [Statement, ...Statement[]]);
}
