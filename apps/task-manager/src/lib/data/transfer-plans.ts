/**
 * Planificarea transferurilor — persoanele cu ședințe (0021, 0027, 0029, 0034),
 * pe D1.
 *
 * Regula din bază: orice om conectat adaugă și corectează, doar adminul șterge.
 * Jurnalul e `record_transfer_plan_audit` (0029); `updated_at` îl punea
 * `transfer_plans_updated_at`.
 */

import { eq } from "drizzle-orm";

import { NEAUTENTIFICAT, canDeleteRegistry, canWriteRegistry, type Actor } from "@/lib/acl";
import { auditContext, auditInsert, transferPlanAudit } from "@/lib/audit";
import type { Db } from "@/lib/db";
import { transferPlans } from "@/lib/db/schema";
import { isCourt } from "@/lib/courts";
import { INSTITUTIONS } from "@/lib/transfers";
import type { TransferBasis } from "@/lib/transfer-plans";
import { todayInChisinau, toISODate } from "@/lib/periods";
import { type ActionResult, modificaCuJurnal, RAND_DISPARUT, runBatch } from "./common";

type PlanRow = typeof transferPlans.$inferSelect;

const DISPARUTA = "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina.";

export interface PlanInput {
  last_name: string;
  first_name: string;
  basis: TransferBasis;
  court: string;
  institution: string;
  /** Completată la temei „ședință". */
  hearing_date: string;
  /** Data parvenirii deciziei; completată la temei „decizie". */
  decision_date: string;
  /** Data încheierii; completată la temei „30 zile". */
  ruling_date: string;
  note: string;
}

function validate(input: PlanInput, azi: string): string | null {
  if (!input.last_name.trim()) return "Numele e obligatoriu.";
  if (!input.first_name.trim()) return "Prenumele e obligatoriu.";
  // Lista de instanțe e fixă în interfață; verificată și aici, fiindcă acțiunea
  // poate fi apelată și altfel decât prin formular.
  if (input.basis !== "sedinta" && input.basis !== "decizie" && input.basis !== "termen30") {
    return "Alege temeiul.";
  }
  if (!INSTITUTIONS.includes(Number(input.institution))) return "Alege penitenciarul.";

  /*
   * Oglindește constrângerea `transfer_plans_temei` din migrarea 0027.
   *
   * Verificat și aici, nu doar în bază: fără asta, un câmp lăsat gol s-ar
   * întoarce ca o eroare a bazei în engleză, despre o constrângere al cărei
   * nume nu-i spune nimic omului din fața ecranului.
   */
  if (input.basis === "sedinta") {
    if (!isCourt(input.court)) return "Alege instanța din listă.";
    if (!input.hearing_date) return "Data ședinței e obligatorie.";
  } else if (input.basis === "termen30") {
    // Instanța e obligatorie, ca la ședință — așa s-a cerut.
    if (!isCourt(input.court)) return "Alege instanța din listă.";
    if (!input.ruling_date) return "Data încheierii e obligatorie.";
    // Aceeași regulă ca `transfer_plans_ruling_before_start`: o încheiere din
    // viitor e aproape sigur o dată greșit tastată.
    if (input.ruling_date > azi) return "Data încheierii nu poate fi în viitor.";
  } else {
    // Instanța rămâne opțională: o decizie poate veni și din altă parte.
    if (input.court && !isCourt(input.court)) return "Alege instanța din listă.";
    if (!input.decision_date) return "Data parvenirii deciziei e obligatorie.";
  }
  return null;
}

async function updateRow(db: Db, me: Actor, prev: PlanRow, patch: Partial<PlanRow>): Promise<ActionResult> {
  const ctx = auditContext(me);
  const full = { ...patch, updated_by: me.id, updated_at: ctx.at };
  try {
    const atins = await modificaCuJurnal(
      db,
      db.update(transferPlans).set(full).where(eq(transferPlans.id, prev.id)),
      ctx,
      [transferPlanAudit("UPDATE", prev, { ...prev, ...full })],
    );
    if (!atins) return { error: RAND_DISPARUT };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
  return { success: true };
}

async function getPlan(db: Db, id: string): Promise<PlanRow | undefined> {
  return db.select().from(transferPlans).where(eq(transferPlans.id, id)).get();
}

export async function savePlan(
  db: Db,
  me: Actor | null,
  id: string | null,
  input: PlanInput,
): Promise<ActionResult> {
  // Ziua Chișinăului, nu a serverului: pe UTC, o încheiere introdusă după
  // miezul nopții de aici și-ar fi pornit termenul cu o zi în urmă.
  const azi = toISODate(todayInChisinau());
  const problem = validate(input, azi);
  if (problem) return { error: problem };
  if (!me) return { error: NEAUTENTIFICAT };
  if (!canWriteRegistry(me)) return { error: DISPARUTA };

  const prev = id ? await getPlan(db, id) : undefined;
  // Un rând dispărut (șters de altcineva cât era dialogul deschis) nu e o
  // reușită: fără verificare am spune „Însemnare salvată." despre nimic.
  if (id && !prev) return { error: DISPARUTA };

  /*
   * Ziua de la care curg cele 30 de zile: ziua introducerii.
   *
   * O însemnare care era deja pe „30 zile" își păstrează ziua — altfel o
   * corectură oarecare ar fi repornit termenul de la zero. Una nouă, sau una
   * mutată acum de pe alt temei, o primește pe cea de azi: atunci a fost
   * introdusă încheierea. Pe celelalte temeiuri se scrie `null`.
   */
  let termStart: string | null = null;
  if (input.basis === "termen30") {
    termStart = prev?.basis === "termen30" && prev.term_start ? prev.term_start : azi;
  }

  const values = {
    last_name: input.last_name.trim(),
    first_name: input.first_name.trim(),
    basis: input.basis,
    court: input.court ? input.court : null,
    institution: Number(input.institution),
    // Exact una dintre ele e completată — celelalte se scriu `null` explicit, ca
    // o planificare mutată de pe un temei pe altul să nu păstreze data veche.
    hearing_date: input.basis === "sedinta" ? input.hearing_date : null,
    decision_date: input.basis === "decizie" ? input.decision_date : null,
    ruling_date: input.basis === "termen30" ? input.ruling_date : null,
    term_start: termStart,
    note: input.note.trim() ? input.note.trim() : null,
  };

  if (prev) return updateRow(db, me, prev, values);

  const ctx = auditContext(me);
  const row: PlanRow = {
    id: crypto.randomUUID(),
    ...values,
    done: false,
    notified_at: null,
    notified_by: null,
    notified_hearing_date: null,
    created_by: me.id,
    updated_by: me.id,
    created_at: ctx.at,
    updated_at: ctx.at,
  };
  try {
    await runBatch(db, [
      db.insert(transferPlans).values(row),
      auditInsert(db, ctx, [transferPlanAudit("INSERT", null, row)]),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Eroare la salvare." };
  }
  return { success: true };
}

/** Încheiat după ședință: iese din listă, dar rămâne în evidență. */
export async function setPlanDone(db: Db, me: Actor | null, id: string, done: boolean): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await getPlan(db, id);
  if (!prev || !canWriteRegistry(me)) return { error: DISPARUTA };
  return updateRow(db, me, prev, { done });
}

/**
 * Bifează că înștiințarea despre imposibilitatea executării a fost expediată.
 *
 * Se ține minte și ședința pentru care s-a trimis, nu doar data expedierii:
 * ziua de transfer se calculează din data ședinței, deci o amânare scoate omul
 * din grupul „de înștiințat", iar dacă se amână iarăși într-o zi imposibilă e
 * altă situație și cere altă hârtie. Vezi `esteInstiintat`.
 *
 * Ședința se citește din rândul din bază, nu din ce trimite pagina: între
 * încărcarea listei și apăsarea butonului, altcineva poate să fi mutat data —
 * iar atunci bifa ar fi ajuns pe ședința veche, care nu mai există.
 */
export async function setPlanNotified(
  db: Db,
  me: Actor | null,
  id: string,
  notified: boolean,
): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await getPlan(db, id);
  if (!prev || !canWriteRegistry(me)) return { error: DISPARUTA };
  if (notified && !prev.hearing_date) {
    // Grupul „de înștiințat" apare numai la ședințe; fără dată n-ar avea ce
    // acoperi hârtia.
    return { error: "Însemnarea n-are dată de ședință, deci nu are ce înștiința." };
  }

  return updateRow(
    db,
    me,
    prev,
    notified
      ? { notified_at: new Date().toISOString(), notified_by: me.id, notified_hearing_date: prev.hearing_date }
      : { notified_at: null, notified_by: null, notified_hearing_date: null },
  );
}

export async function deletePlan(db: Db, me: Actor | null, id: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await getPlan(db, id);
  if (!prev || !canDeleteRegistry(me)) return { error: "Însemnarea nu există sau nu ai dreptul." };
  const atins = await modificaCuJurnal(
    db,
    db.delete(transferPlans).where(eq(transferPlans.id, id)),
    auditContext(me),
    [transferPlanAudit("DELETE", prev, null)],
  );
  if (!atins) return { error: RAND_DISPARUT };
  return { success: true };
}
