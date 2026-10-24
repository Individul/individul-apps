/**
 * Eliberările pe zile (0026), pe D1.
 *
 * Regula din bază: orice om conectat scrie și corectează, doar adminul șterge.
 * Jurnalul e `record_release_audit`; `updated_at` îl punea triggerul
 * `releases_updated_at`.
 */

import { eq } from "drizzle-orm";

import { NEAUTENTIFICAT, canWriteRegistry, type Actor } from "@/lib/acl";
import { auditContext, auditInsert, releaseAudit } from "@/lib/audit";
import { isUniqueViolation, type Db } from "@/lib/db";
import { releases } from "@/lib/db/schema";
import { type ActionResult, modificaCuJurnal, RAND_DISPARUT, runBatch } from "./common";

const LIPSA =
  "Ziua nu s-a putut salva — probabil nu mai ai dreptul s-o scrii. Reîncarcă pagina.";

/** Cifra vine din formular ca text; golul, negativul și non-numericul cad aici. */
function toCount(value: unknown): number | string {
  /*
   * Câmpul golit se respinge, nu se citește ca zero.
   *
   * `Number("")` e 0, iar `Number.isInteger(0)` e adevărat, deci fără rândul
   * ăsta ștergerea cifrei din câmp ar salva liniștit „0 eliberați". Or „—" și
   * „0" spun lucruri diferite, și dinadins: „—" e ziua necompletată, „0" e
   * ziua verificată în care n-a ieșit nimeni (vezi `release-entry.tsx` și
   * README). Un câmp gol e cel mult prima variantă, dar s-ar scrie ca a doua —
   * afirmația mai tare din cele două, făcută fără ca nimeni s-o fi făcut.
   */
  const text = typeof value === "string" ? value.trim() : value;
  if (text === "" || text === null || text === undefined) {
    return "Eliberați: scrie un număr. Dacă în ziua aceea n-a ieșit nimeni, scrie 0.";
  }
  const n = Number(text);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Eliberați: introdu un număr întreg.";
  // Aceeași limită ca `check (count >= 0)` din migrarea 0026.
  if (n < 0) return "Eliberați: numărul nu poate fi negativ.";
  return n;
}

/**
 * Scrie eliberările unei zile. Un rând pe zi, deci a doua introducere pentru
 * aceeași dată o corectează pe prima — cine a schimbat și din ce în ce rămâne
 * în jurnalul de audit.
 *
 * Zero e o valoare validă: pe o zi în care n-a ieșit nimeni, zeroul e singurul
 * fel de a spune că ziua a fost verificată, nu uitată.
 *
 * Ce era `upsert` în Supabase devine aici „citește, apoi inserează sau
 * corectează": jurnalul trebuie să spună INSERT sau UPDATE, cum spunea și
 * Postgres (la `on conflict do update` trecea pe ramura UPDATE a triggerului).
 * `created_by` se păstrează la corectare — altfel prima corectare făcută de
 * altcineva ar șterge cine a deschis ziua.
 */
export async function saveRelease(
  db: Db,
  me: Actor | null,
  date: string,
  count: unknown,
  note: string,
): Promise<ActionResult> {
  if (!date) return { error: "Alege ziua." };

  const cifra = toCount(count);
  if (typeof cifra === "string") return { error: cifra };

  if (!me) return { error: NEAUTENTIFICAT };
  if (!canWriteRegistry(me)) return { error: LIPSA };

  const ctx = auditContext(me);
  const values = { count: cifra, note: note.trim() ? note.trim() : null, updated_by: me.id };
  const existing = await db.select().from(releases).where(eq(releases.release_date, date)).get();

  try {
    if (existing) {
      const patch = { ...values, created_by: existing.created_by ?? me.id, updated_at: ctx.at };
      const atins = await modificaCuJurnal(
        db,
        db.update(releases).set(patch).where(eq(releases.id, existing.id)),
        ctx,
        [releaseAudit("UPDATE", existing, { ...existing, ...patch })],
      );
      if (!atins) return { error: RAND_DISPARUT };
    } else {
      const row = {
        id: crypto.randomUUID(),
        release_date: date,
        ...values,
        created_by: me.id,
        created_at: ctx.at,
        updated_at: ctx.at,
      };
      await runBatch(db, [db.insert(releases).values(row), auditInsert(db, ctx, [releaseAudit("INSERT", null, row)])]);
    }
  } catch (e) {
    // Doi colegi au salvat aceeași zi în același moment: al doilea reia salvarea
    // și găsește rândul, deci primește o corectare, nu o eroare de duplicat.
    if (isUniqueViolation(e) && !existing) return saveRelease(db, me, date, count, note);
    return { error: e instanceof Error ? e.message : LIPSA };
  }
  return { success: true };
}
