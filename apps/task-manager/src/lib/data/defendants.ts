/**
 * Preveniții și inculpații (0025, 0028), pe D1.
 *
 * Regula din bază: orice om conectat adaugă și corectează, doar adminul șterge.
 * Jurnalul e `record_defendant_audit`; `updated_at` îl punea
 * `defendants_updated_at`.
 */

import { eq } from "drizzle-orm";

import { NEAUTENTIFICAT, canDeleteRegistry, canWriteRegistry, type Actor } from "@/lib/acl";
import { auditContext, auditInsert, defendantAudit } from "@/lib/audit";
import type { Db } from "@/lib/db";
import { defendants } from "@/lib/db/schema";
import { isCourt } from "@/lib/courts";
import { ziValida } from "@/lib/periods";
import { type ActionResult, modificaCuJurnal, RAND_DISPARUT, runBatch } from "./common";

type DefendantRow = typeof defendants.$inferSelect;

const DISPARUTA = "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina.";

export interface DefendantInput {
  last_name: string;
  first_name: string;
  regime: string;
  established_on: string;
  court: string;
  case_number: string;
  /** Are măsură preventivă? De aici se citește categoria „prevenit". */
  preventive_measure: boolean;
  /** Data măsurii, dacă e știută. Ignorată când nu există măsură. */
  preventive_measure_on: string;
  note: string;
}

function validate(input: DefendantInput): string | null {
  if (!input.last_name.trim()) return "Numele e obligatoriu.";
  if (!input.first_name.trim()) return "Prenumele e obligatoriu.";
  if (input.regime !== "inchis" && input.regime !== "semiinchis") {
    return "Alege tipul de penitenciar.";
  }
  if (!input.established_on) return "Data stabilirii e obligatorie.";
  if (!ziValida(input.established_on)) return "Data stabilirii nu e o zi care există.";
  if (input.preventive_measure && input.preventive_measure_on && !ziValida(input.preventive_measure_on)) {
    return "Data măsurii preventive nu e o zi care există.";
  }
  // Instanța e opțională, dar dacă e dată trebuie să fie una din listă: altfel
  // aceeași judecătorie ar ajunge scrisă în trei feluri în două evidențe.
  if (input.court && !isCourt(input.court)) return "Alege instanța din listă.";
  return null;
}

/**
 * Corectarea unui rând existent, cu jurnalul ei. Un rând dispărut (șters de
 * altcineva cât era dialogul deschis) nu e o reușită: fără verificare am spune
 * „Însemnare salvată." despre nimic.
 */
async function updateRow(
  db: Db,
  me: Actor,
  id: string,
  patch: Partial<DefendantRow>,
): Promise<ActionResult> {
  const prev = await db.select().from(defendants).where(eq(defendants.id, id)).get();
  if (!prev || !canWriteRegistry(me)) return { error: DISPARUTA };
  const ctx = auditContext(me);
  const full = { ...patch, updated_by: me.id, updated_at: ctx.at };
  try {
    const atins = await modificaCuJurnal(
      db,
      db.update(defendants).set(full).where(eq(defendants.id, id)),
      ctx,
      [defendantAudit("UPDATE", prev, { ...prev, ...full })],
    );
    if (!atins) return { error: RAND_DISPARUT };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
  return { success: true };
}

export async function saveDefendant(
  db: Db,
  me: Actor | null,
  id: string | null,
  input: DefendantInput,
): Promise<ActionResult> {
  const problem = validate(input);
  if (problem) return { error: problem };
  if (!me) return { error: NEAUTENTIFICAT };

  const values = {
    last_name: input.last_name.trim(),
    first_name: input.first_name.trim(),
    regime: input.regime as DefendantRow["regime"],
    established_on: input.established_on,
    court: input.court ? input.court : null,
    case_number: input.case_number.trim() ? input.case_number.trim() : null,
    preventive_measure: input.preventive_measure,
    // Oglindește `defendants_preventive` din migrarea 0028: fără măsură, data
    // se scrie `null` — o dată a unei măsuri care nu există ar fi o afirmație
    // despre nimic, iar baza ar respinge-o oricum.
    preventive_measure_on:
      input.preventive_measure && input.preventive_measure_on ? input.preventive_measure_on : null,
    note: input.note.trim() ? input.note.trim() : null,
  };

  if (id) return updateRow(db, me, id, values);

  if (!canWriteRegistry(me)) return { error: DISPARUTA };
  const ctx = auditContext(me);
  const row: DefendantRow = {
    id: crypto.randomUUID(),
    ...values,
    status: "inculpat",
    convicted_on: null,
    created_by: me.id,
    updated_by: me.id,
    created_at: ctx.at,
    updated_at: ctx.at,
  };
  try {
    await runBatch(db, [db.insert(defendants).values(row), auditInsert(db, ctx, [defendantAudit("INSERT", null, row)])]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
  return { success: true };
}

/**
 * Trecerea la condamnat. Data nu e opțională: starea și data se verifică una pe
 * alta în bază, iar un condamnat fără dată n-ar putea fi numărat pe luni.
 */
export async function markConvicted(
  db: Db,
  me: Actor | null,
  id: string,
  convictedOn: string,
): Promise<ActionResult> {
  if (!convictedOn) return { error: "Data condamnării e obligatorie." };
  // Data vine dintr-un câmp scris de mână, deci forma se verifică aici: altfel
  // „3 august" ar ajunge la bază și s-ar întoarce cu o eroare a bazei, pe care
  // cel care a scris n-are cum s-o lege de ce a greșit.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(convictedOn)) {
    return { error: "Data trebuie scrisă ca AAAA-LL-ZZ, de pildă 2026-08-03." };
  }
  // Separat de tipar: „2026-02-30" are forma bună, iar `Date.parse` o primește.
  if (!ziValida(convictedOn)) return { error: "Data condamnării nu e o zi care există." };
  if (!me) return { error: NEAUTENTIFICAT };
  return updateRow(db, me, id, { status: "condamnat", convicted_on: convictedOn });
}

/** Readuce în lista de lucru o trecere făcută din greșeală. */
export async function undoConvicted(db: Db, me: Actor | null, id: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  return updateRow(db, me, id, { status: "inculpat", convicted_on: null });
}

export async function deleteDefendant(db: Db, me: Actor | null, id: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await db.select().from(defendants).where(eq(defendants.id, id)).get();
  if (!prev || !canDeleteRegistry(me)) return { error: "Însemnarea nu există sau nu ai dreptul." };
  const atins = await modificaCuJurnal(
    db,
    db.delete(defendants).where(eq(defendants.id, id)),
    auditContext(me),
    [defendantAudit("DELETE", prev, null)],
  );
  if (!atins) return { error: RAND_DISPARUT };
  return { success: true };
}
