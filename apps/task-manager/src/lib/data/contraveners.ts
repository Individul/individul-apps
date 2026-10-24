/**
 * Contravenienții — arestul contravențional (0031, 0032), pe D1.
 *
 * Regula din bază: orice om conectat adaugă și corectează, doar adminul șterge.
 * Jurnalul e `record_contravener_audit`; `updated_at` îl punea
 * `contraveners_updated_at`.
 */

import { eq } from "drizzle-orm";

import { NEAUTENTIFICAT, canDeleteRegistry, canWriteRegistry, type Actor } from "@/lib/acl";
import { auditContext, auditInsert, contravenerAudit } from "@/lib/audit";
import type { Db } from "@/lib/db";
import { contraveners } from "@/lib/db/schema";
import { prescriptieOf, validateContravener, type ContravenerInput } from "@/lib/contraveners";
import { todayInChisinau, toISODate } from "@/lib/periods";
import { runBatch, type ActionResult } from "./common";

type ContravenerRow = typeof contraveners.$inferSelect;

const DISPARUTA = "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina.";

async function updateRow(
  db: Db,
  me: Actor,
  prev: ContravenerRow,
  patch: Partial<ContravenerRow>,
): Promise<ActionResult> {
  const ctx = auditContext(me);
  const full = { ...patch, updated_by: me.id, updated_at: ctx.at };
  try {
    await runBatch(db, [
      db.update(contraveners).set(full).where(eq(contraveners.id, prev.id)),
      auditInsert(db, ctx, [contravenerAudit("UPDATE", prev, { ...prev, ...full })]),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
  return { success: true };
}

export async function saveContravener(
  db: Db,
  me: Actor | null,
  id: string | null,
  input: ContravenerInput,
): Promise<ActionResult> {
  // Poarta reală e aici, nu în formular: o acțiune de server se poate chema
  // și fără el. Ziua de azi e a Chișinăului — serverul merge pe UTC, iar o
  // executare trecută azi la 1 noaptea ar fi fost respinsă drept „în viitor".
  const problem = validateContravener(input, toISODate(todayInChisinau()));
  if (problem) return { error: problem };
  if (!me) return { error: NEAUTENTIFICAT };
  if (!canWriteRegistry(me)) return { error: DISPARUTA };

  const values = {
    last_name: input.last_name.trim(),
    first_name: input.first_name.trim(),
    patronymic: input.patronymic.trim() ? input.patronymic.trim() : null,
    decision_date: input.decision_date,
    final_date: input.final_date ? input.final_date : null,
    arrest_days: Number(input.arrest_days.trim()),
    executed_on: input.executed_on ? input.executed_on : null,
  };

  if (id) {
    // Un rând dispărut (șters de altcineva cât era dialogul deschis) nu e o
    // reușită: fără verificare am spune „Însemnare salvată." despre nimic.
    const prev = await db.select().from(contraveners).where(eq(contraveners.id, id)).get();
    if (!prev) return { error: DISPARUTA };
    return updateRow(db, me, prev, values);
  }

  const ctx = auditContext(me);
  const row: ContravenerRow = {
    id: crypto.randomUUID(),
    ...values,
    informed_at: null,
    informed_by: null,
    created_by: me.id,
    updated_by: me.id,
    created_at: ctx.at,
    updated_at: ctx.at,
  };
  try {
    await runBatch(db, [
      db.insert(contraveners).values(row),
      auditInsert(db, ctx, [contravenerAudit("INSERT", null, row)]),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
  return { success: true };
}

export async function deleteContravener(db: Db, me: Actor | null, id: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await db.select().from(contraveners).where(eq(contraveners.id, id)).get();
  // Ca RLS: ștergerea e doar a adminului; celorlalți li se spune același lucru
  // ca pentru un rând inexistent.
  if (!prev || !canDeleteRegistry(me)) return { error: "Însemnarea nu există sau nu ai dreptul." };
  await runBatch(db, [
    db.delete(contraveners).where(eq(contraveners.id, id)),
    auditInsert(db, auditContext(me), [contravenerAudit("DELETE", prev, null)]),
  ]);
  return { success: true };
}

/**
 * Bifează (sau scoate) informarea despre prescripție ca expediată.
 *
 * Starea se verifică aici, din rândul citit acum, nu din ce avea browserul pe
 * ecran: între timp cineva poate să fi trecut data executării sau să fi
 * corectat data definitivă, iar o informare bifată pe o hotărâre care nu e
 * prescrisă ar spune în registru că s-a trimis o hârtie care n-avea temei.
 * Scoaterea bifei merge oricând — e felul de a îndrepta o apăsare greșită.
 */
export async function setContravenerInformed(
  db: Db,
  me: Actor | null,
  id: string,
  informed: boolean,
): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await db.select().from(contraveners).where(eq(contraveners.id, id)).get();
  if (!prev || !canWriteRegistry(me)) return { error: DISPARUTA };

  if (informed) {
    const p = prescriptieOf(prev, toISODate(todayInChisinau()));
    if (p.stare !== "prescris") {
      return {
        error:
          p.stare === "executat"
            ? "Arestul e trecut ca executat, deci nu e nimic de informat."
            : "Termenul de executare încă n-a expirat. Reîncarcă pagina.",
      };
    }
  }

  return updateRow(
    db,
    me,
    prev,
    informed
      ? { informed_at: new Date().toISOString(), informed_by: me.id }
      : { informed_at: null, informed_by: null },
  );
}
