/**
 * Ședințele de judecată (0018), pe D1.
 *
 * Regula din bază: orice om conectat adaugă și corectează o zi, doar adminul o
 * șterge. Jurnalul e ramura `hearings` din `record_audit`, iar `updated_at` îl
 * punea triggerul `hearings_updated_at` — acum îl pune scrierea de aici.
 * Totalurile (`tc_total`, `ij_total`, `total_general`) rămân coloane generate:
 * nu se scriu niciodată.
 */

import { eq } from "drizzle-orm";

import { NEAUTENTIFICAT, canDeleteRegistry, canWriteRegistry, type Actor } from "@/lib/acl";
import { auditContext, auditInsert, hearingAudit } from "@/lib/audit";
import { isUniqueViolation, type Db } from "@/lib/db";
import { hearings } from "@/lib/db/schema";
import type { HearingCounts } from "@/lib/hearings";
import { runBatch, type ActionResult } from "./common";

/** Cifrele vin din formular ca text; negativul și non-numericul cad aici. */
function toCount(value: unknown, label: string): number | string {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${label}: introdu un număr întreg.`;
  if (n < 0) return `${label}: numărul nu poate fi negativ.`;
  return n;
}

export interface HearingInput {
  session_date: string;
  tc_petrecute: unknown;
  tc_amanate: unknown;
  ij_petrecute: unknown;
  ij_amanate: unknown;
  note: string;
}

const FIELDS: { key: keyof HearingCounts; label: string }[] = [
  { key: "tc_petrecute", label: "Teleconferință — petrecute" },
  { key: "tc_amanate", label: "Teleconferință — amânate" },
  { key: "ij_petrecute", label: "Instanța de judecată — petrecute" },
  { key: "ij_amanate", label: "Instanța de judecată — amânate" },
];

/**
 * Salvează ziua. Registrul are un singur rând pe zi, deci o a doua introducere
 * pentru aceeași dată o corectează pe prima în loc să adauge un duplicat —
 * cine a schimbat și când rămâne în jurnalul de audit.
 */
export async function saveHearing(db: Db, me: Actor | null, input: HearingInput): Promise<ActionResult> {
  if (!input.session_date) return { error: "Alege ziua." };

  const counts: Partial<HearingCounts> = {};
  for (const f of FIELDS) {
    const parsed = toCount(input[f.key], f.label);
    if (typeof parsed === "string") return { error: parsed };
    counts[f.key] = parsed;
  }

  if (!me) return { error: NEAUTENTIFICAT };
  if (!canWriteRegistry(me)) return { error: "Fără permisiune." };

  const ctx = auditContext(me);
  const values = {
    ...(counts as HearingCounts),
    note: input.note.trim() ? input.note.trim() : null,
    updated_by: me.id,
  };

  // Nu upsert: acela ar rescrie și `created_by`, adică cine a deschis ziua s-ar
  // pierde la prima corectare făcută de altcineva.
  const existing = await db.select().from(hearings).where(eq(hearings.session_date, input.session_date)).get();

  if (existing) {
    const next = { ...existing, ...values, updated_at: ctx.at };
    await runBatch(db, [
      db
        .update(hearings)
        .set({ ...values, updated_at: ctx.at })
        .where(eq(hearings.id, existing.id)),
      auditInsert(db, ctx, [hearingAudit("UPDATE", existing, next)]),
    ]);
  } else {
    const row = {
      id: crypto.randomUUID(),
      session_date: input.session_date,
      ...values,
      created_by: me.id,
      created_at: ctx.at,
      updated_at: ctx.at,
    };
    try {
      await runBatch(db, [db.insert(hearings).values(row), auditInsert(db, ctx, [hearingAudit("INSERT", null, row)])]);
    } catch (e) {
      // Doi oameni au deschis aceeași zi în același moment.
      if (isUniqueViolation(e)) {
        return { error: "Ziua tocmai a fost introdusă de altcineva. Reîncarcă pagina." };
      }
      return { error: e instanceof Error ? e.message : "Eroare la salvarea zilei." };
    }
  }
  return { success: true };
}

export async function deleteHearing(db: Db, me: Actor | null, date: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await db.select().from(hearings).where(eq(hearings.session_date, date)).get();
  // Ca RLS: membrului i se pare că ziua nu există, fiindcă nu o poate atinge.
  if (!prev || !canDeleteRegistry(me)) return { error: "Ziua nu există sau nu ai dreptul s-o ștergi." };
  await runBatch(db, [
    db.delete(hearings).where(eq(hearings.id, prev.id)),
    auditInsert(db, auditContext(me), [hearingAudit("DELETE", prev, null)]),
  ]);
  return { success: true };
}
