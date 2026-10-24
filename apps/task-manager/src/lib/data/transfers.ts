/**
 * Transferurile — cifre pe zi și penitenciar (0020), pe D1.
 *
 * Regula din bază: orice om conectat adaugă și corectează, doar adminul șterge.
 * Jurnalul e ramura `transfers` din `record_audit`; `updated_at` îl punea
 * `transfers_updated_at`. `total` e coloană generată și nu se scrie.
 */

import { eq } from "drizzle-orm";

import { NEAUTENTIFICAT, canDeleteRegistry, canWriteRegistry, type Actor } from "@/lib/acl";
import { auditContext, auditInsert, transferAudit } from "@/lib/audit";
import { isUniqueViolation, type Db } from "@/lib/db";
import { transfers } from "@/lib/db/schema";
import { INSTITUTIONS } from "@/lib/transfers";
import { type ActionResult, modificaCuJurnal, RAND_DISPARUT, runBatch } from "./common";

/**
 * Ciocnirea cu cheia unică (zi + penitenciar + tip) nu e o defecțiune, ci cazul
 * obișnuit în care ziua a fost deja completată — mesajul spune ce urmează.
 */
const DUPLICAT =
  "Există deja un rând pentru penitenciarul acesta în ziua asta. " +
  "Editează-l în loc să adaugi altul.";

const LIPSA_LA_MODIFICARE =
  "Rândul nu mai există sau nu ai dreptul să-l modifici. Reîncarcă pagina.";

const LIPSA_LA_STERGERE = "Rândul nu mai există sau ștergerea e rezervată adminului.";

/** Cifrele vin din formular ca text; negativul și non-numericul cad aici. */
function toCount(value: unknown, label: string): number | string {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${label}: introdu un număr întreg.`;
  if (n < 0) return `${label}: numărul nu poate fi negativ.`;
  return n;
}

export interface TransferInput {
  transfer_date: string;
  institution: unknown;
  kind: string;
  plecati: unknown;
  sositi: unknown;
  note: string;
}

interface TransferValues {
  transfer_date: string;
  institution: number;
  kind: "planificat" | "urgent";
  plecati: number;
  sositi: number;
  note: string | null;
}

/**
 * Rândul de scris, sau mesajul de eroare dacă formularul nu ține.
 *
 * `total` lipsește dinadins: e coloană generată, iar baza ar respinge o valoare
 * scrisă în ea.
 *
 * Un rând cu 0 și 0 rămâne valid: pe o zi programată în care n-a mișcat nimeni, e
 * singurul fel de a spune că ziua a avut loc — altfel ar fi raportată ca lipsă.
 */
function validate(input: TransferInput): TransferValues | string {
  if (!input.transfer_date) return "Alege ziua transferului.";

  const institution = Number(input.institution);
  // Aceeași listă ca în constrângerea din bază: nr. 6 suntem noi, nr. 14 nu există.
  if (!INSTITUTIONS.includes(institution)) return "Alege penitenciarul partener.";

  if (input.kind !== "planificat" && input.kind !== "urgent") {
    return "Alege tipul transferului: planificat sau urgent.";
  }

  const plecati = toCount(input.plecati, "Plecați");
  if (typeof plecati === "string") return plecati;
  const sositi = toCount(input.sositi, "Sosiți");
  if (typeof sositi === "string") return sositi;

  return {
    transfer_date: input.transfer_date,
    institution,
    kind: input.kind,
    plecati,
    sositi,
    note: input.note.trim() ? input.note.trim() : null,
  };
}

export async function createTransfer(db: Db, me: Actor | null, input: TransferInput): Promise<ActionResult> {
  const values = validate(input);
  if (typeof values === "string") return { error: values };
  if (!me) return { error: NEAUTENTIFICAT };
  if (!canWriteRegistry(me)) return { error: LIPSA_LA_MODIFICARE };

  const ctx = auditContext(me);
  const row = {
    id: crypto.randomUUID(),
    ...values,
    created_by: me.id,
    updated_by: me.id,
    created_at: ctx.at,
    updated_at: ctx.at,
  };
  try {
    await runBatch(db, [db.insert(transfers).values(row), auditInsert(db, ctx, [transferAudit("INSERT", null, row)])]);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: DUPLICAT };
    return { error: e instanceof Error ? e.message : "Eroare la salvarea rândului." };
  }
  return { success: true };
}

export async function updateTransfer(
  db: Db,
  me: Actor | null,
  id: string,
  input: TransferInput,
): Promise<ActionResult> {
  const values = validate(input);
  if (typeof values === "string") return { error: values };
  if (!me) return { error: NEAUTENTIFICAT };

  // Un rând dispărut (șters de altcineva) sau neatins de drept nu e o reușită.
  const prev = await db.select().from(transfers).where(eq(transfers.id, id)).get();
  if (!prev || !canWriteRegistry(me)) return { error: LIPSA_LA_MODIFICARE };

  const ctx = auditContext(me);
  const patch = { ...values, updated_by: me.id, updated_at: ctx.at };
  try {
    const atins = await modificaCuJurnal(
      db,
      db.update(transfers).set(patch).where(eq(transfers.id, id)),
      ctx,
      [transferAudit("UPDATE", prev, { ...prev, ...patch })],
    );
    if (!atins) return { error: RAND_DISPARUT };
  } catch (e) {
    // Mutarea rândului peste unul existent (altă zi, alt penitenciar, alt tip).
    if (isUniqueViolation(e)) return { error: DUPLICAT };
    return { error: e instanceof Error ? e.message : "Eroare la salvarea rândului." };
  }
  return { success: true };
}

export async function deleteTransfer(db: Db, me: Actor | null, id: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await db.select().from(transfers).where(eq(transfers.id, id)).get();
  if (!prev || !canDeleteRegistry(me)) return { error: LIPSA_LA_STERGERE };
  const atins = await modificaCuJurnal(
    db,
    db.delete(transfers).where(eq(transfers.id, id)),
    auditContext(me),
    [transferAudit("DELETE", prev, null)],
  );
  if (!atins) return { error: RAND_DISPARUT };
  return { success: true };
}
