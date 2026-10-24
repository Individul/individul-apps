/**
 * Petițiile — scrierile, pe D1.
 *
 * Ce făcea Postgres singur și se face acum aici:
 * - regulile RLS din 0012 („petitions insert/update/delete"), prin `acl.ts`,
 *   cu „update" verificat pe rândul de dinainte și pe cel de după (WITH CHECK);
 * - `petitions_updated_at`, pus la fiecare actualizare;
 * - jurnalul (`record_audit`, ramurile `petitions` și `petition_attachments`),
 *   în același `batch` cu schimbarea. La ștergere, atașamentele pleacă în
 *   cascadă, iar Postgres le jurnaliza pe fiecare înaintea petiției.
 *
 * `response_deadline` e coloană generată: n-o scrie nimeni, o calculează D1.
 */

import { eq } from "drizzle-orm";

import {
  NEAUTENTIFICAT,
  canDeletePetitionRow,
  canInsertPetition,
  canUpdatePetition,
  type Actor,
} from "@/lib/acl";
import { attachmentAudit, auditContext, auditInsert, petitionAudit } from "@/lib/audit";
import { hasChanges } from "@/lib/changes";
import { isUniqueViolation, type Db } from "@/lib/db";
import { petitionAttachments, petitions } from "@/lib/db/schema";
import { notifyPetition } from "@/lib/notify-petition";
import { todayInChisinau, toISODate } from "@/lib/periods";
import type { PetitionStatus, PetitionerType } from "@/lib/types";
import { STATUS_LABEL } from "@/components/petitions/meta";
import { type ActionResult, modificaCuJurnal, namesOf, RAND_DISPARUT, runBatch } from "./common";
import { removeObjects, type FileStore } from "./attachments";

/** La creare întoarcem și identitatea rândului, ca dialogul să treacă direct
 *  în modul editare și să permită atașarea fișierelor fără a fi redeschis. */
export type CreatePetitionResult = ActionResult & { id?: string; number?: string };

export interface PetitionInput {
  petitioner: string;
  petitioner_type: PetitionerType;
  subject: string;
  received_date: string;
  assignee_id: string;
  status: PetitionStatus;
  response: string;
  response_date: string;
}

type PetitionRow = typeof petitions.$inferSelect;

const FARA_DREPT = "Petiție inexistentă sau fără permisiune.";
const NUMAR_DUBLU = "Există deja o petiție cu acest număr.";
/**
 * Refuzul WITH CHECK. Cazul realist: schimbarea responsabilului de către
 * cineva care nu e creator — rândul nou nu mai e nici al lui, nici pe el.
 * Postgres întorcea aici o eroare în engleză; mesajul e cel pe care
 * aplicația îl punea deja peste ea.
 */
const REFUZ_RESPONSABIL =
  "Baza de date a refuzat modificarea: doar creatorul petiției sau un " +
  "administrator poate schimba responsabilul.";

/**
 * Ziua de azi la Chișinău, nu pe ceasul serverului: pe Vercel și pe Workers
 * acela e UTC, iar între miezul nopții și ora 3 ziua ar fi fost cea de ieri.
 */
function today(): string {
  return toISODate(todayInChisinau());
}

function yearSuffix(dateStr: string): string {
  const y = (dateStr || "").slice(0, 4);
  return (y || String(new Date().getFullYear())).slice(-2);
}

function normalize(input: PetitionInput) {
  return {
    petitioner: input.petitioner.trim(),
    petitioner_type: input.petitioner_type,
    subject: input.subject.trim() ? input.subject.trim() : null,
    received_date: input.received_date || today(),
    status: input.status,
    response: input.response.trim() ? input.response.trim() : null,
    response_date: input.response_date ? input.response_date : null,
    assignee_id: input.assignee_id ? input.assignee_id : null,
  };
}

/** Coloanele care se scriu: fără id, autor, creare și termenul generat. */
function writable(row: PetitionRow) {
  const { id: _i, created_by: _c, created_at: _a, response_deadline: _d, ...rest } = row;
  return rest;
}

async function getPetition(db: Db, id: string): Promise<PetitionRow | undefined> {
  return db.select().from(petitions).where(eq(petitions.id, id)).get();
}

export async function createPetition(
  db: Db,
  me: Actor | null,
  numberPrefix: string,
  input: PetitionInput,
): Promise<CreatePetitionResult> {
  const prefix = numberPrefix.trim();
  if (!prefix) return { error: "Numărul de înregistrare e obligatoriu." };
  if (!input.petitioner.trim()) return { error: "Petiționarul e obligatoriu." };
  if (!me) return { error: NEAUTENTIFICAT };
  if (!canInsertPetition(me, { created_by: me.id })) return { error: FARA_DREPT };

  const ctx = auditContext(me);
  const nt = normalize(input);
  const row = {
    id: crypto.randomUUID(),
    ...nt,
    number: `${prefix}/${yearSuffix(nt.received_date)}`,
    created_by: me.id,
    created_at: ctx.at,
    updated_at: ctx.at,
  };
  try {
    await runBatch(db, [
      db.insert(petitions).values(row),
      auditInsert(db, ctx, [petitionAudit("INSERT", null, row, () => null)]),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: NUMAR_DUBLU };
    return { error: e instanceof Error ? e.message : "Eroare la înregistrarea petiției." };
  }

  const ref = { id: row.id, number: row.number, assignee_id: nt.assignee_id, created_by: me.id };
  // Adminii află de orice petiție nouă, chiar dacă autorul și-a atribuit-o singur.
  await notifyPetition(db, me, "created", ref);
  if (nt.assignee_id) {
    // Adminii au primit deja „created" pentru aceeași acțiune — fără copie dublă.
    await notifyPetition(db, me, "assigned", ref, undefined, false);
  }
  return { success: true, id: ref.id, number: ref.number };
}

export async function updatePetition(
  db: Db,
  me: Actor | null,
  id: string,
  number: string,
  input: PetitionInput,
): Promise<ActionResult> {
  if (!number.trim()) return { error: "Numărul de înregistrare e obligatoriu." };
  if (!input.petitioner.trim()) return { error: "Petiționarul e obligatoriu." };
  if (!me) return { error: NEAUTENTIFICAT };

  // Rândul de dinainte: spune ce anume s-a schimbat și dacă s-a schimbat ceva.
  const prev = await getPetition(db, id);
  if (!prev || !canUpdatePetition(me, prev)) return { error: FARA_DREPT };

  const ctx = auditContext(me);
  const payload = { ...normalize(input), number: number.trim() };
  const next: PetitionRow = { ...prev, ...payload, updated_at: ctx.at };
  if (!canUpdatePetition(me, next)) return { error: REFUZ_RESPONSABIL };

  const nameOf = await namesOf(db, [prev.assignee_id, next.assignee_id]);
  try {
    const atins = await modificaCuJurnal(
      db,
      db.update(petitions).set(writable(next)).where(eq(petitions.id, id)),
      ctx,
      [petitionAudit("UPDATE", prev, next, nameOf)],
    );
    if (!atins) return { error: RAND_DISPARUT };
  } catch (e) {
    if (isUniqueViolation(e)) return { error: NUMAR_DUBLU };
    return { error: e instanceof Error ? e.message : "Eroare la salvarea petiției." };
  }

  // Un „Salvează" care n-a schimbat nimic nu trebuie să notifice pe nimeni.
  if (hasChanges(prev, payload)) {
    const ref = { id, number: next.number, assignee_id: next.assignee_id, created_by: prev.created_by };
    if (next.assignee_id && next.assignee_id !== prev.assignee_id) {
      await notifyPetition(db, me, "assigned", ref);
    } else if (next.status !== prev.status) {
      await notifyPetition(db, me, "status", ref, STATUS_LABEL[next.status]);
    } else {
      await notifyPetition(db, me, "edited", ref);
    }
  }
  return { success: true };
}

export async function deletePetition(
  db: Db,
  files: FileStore,
  me: Actor | null,
  id: string,
): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  // Datele se citesc înainte: după ștergere nu mai există de unde compune mesajul.
  const prev = await getPetition(db, id);
  if (!prev || !canDeletePetitionRow(me, prev)) return { error: FARA_DREPT };

  const attachments = await db
    .select()
    .from(petitionAttachments)
    .where(eq(petitionAttachments.petition_id, id));
  const ctx = auditContext(me);
  const atins = await modificaCuJurnal(db, db.delete(petitions).where(eq(petitions.id, id)), ctx, [
    // Triggerul din Postgres scria aici `number: null`: la ștergerea în
    // cascadă petiția nu mai exista când căuta numărul. Aici numărul e știut
    // dinainte și se păstrează, ca jurnalul să spună al cui era fișierul.
    // Nimic nu citește valoarea nulă, deci diferența e doar un câștig.
    ...attachments.map((a) => attachmentAudit("DELETE", a, prev.number)),
    petitionAudit("DELETE", prev, null, () => null),
  ]);
  // Ștearsă de altcineva în aceeași clipă: fișierele le-a scos deja acela.
  if (!atins) return { error: RAND_DISPARUT };
  // Rândurile au plecat în cascadă; obiectele din R2 nu pleacă singure. În
  // Supabase rămâneau orfane în bucket — aici se scot, după ce baza a confirmat.
  await removeObjects(files, attachments.map((a) => a.path));

  await notifyPetition(db, me, "deleted", {
    id,
    number: prev.number,
    assignee_id: prev.assignee_id,
    created_by: prev.created_by,
  });
  return { success: true };
}

/**
 * Finalizare rapidă: trece petiția în „Soluționat" și completează data
 * răspunsului cu ziua curentă dacă lipsește. Dreptul e al lui „petitions
 * update" (admin / creator / responsabil).
 */
export async function finalizePetition(db: Db, me: Actor | null, id: string): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const prev = await getPetition(db, id);
  if (!prev || !canUpdatePetition(me, prev)) return { error: FARA_DREPT };

  const ctx = auditContext(me);
  const next: PetitionRow = {
    ...prev,
    status: "solutionat",
    response_date: prev.response_date ?? today(),
    updated_at: ctx.at,
  };
  const atins = await modificaCuJurnal(
    db,
    db.update(petitions).set(writable(next)).where(eq(petitions.id, id)),
    ctx,
    [petitionAudit("UPDATE", prev, next, () => null)],
  );
  if (!atins) return { error: RAND_DISPARUT };

  await notifyPetition(
    db,
    me,
    "status",
    { id, number: prev.number, assignee_id: prev.assignee_id, created_by: prev.created_by },
    STATUS_LABEL.solutionat,
  );
  return { success: true };
}
