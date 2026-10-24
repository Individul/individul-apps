/**
 * Fișierele petițiilor: rândurile în D1, octeții în R2.
 *
 * În Supabase browserul urca fișierul direct în Storage, iar regula bucketului
 * („petitions bucket insert", 0013) verifica dreptul. R2 n-are reguli de felul
 * ăsta, deci totul trece prin server: aici se verifică sesiunea, dreptul asupra
 * petiției (`can_modify_petition`), tipul și mărimea — aceleași limite ca
 * bucketul vechi —, apoi se scrie obiectul și, abia după, rândul cu jurnalul.
 *
 * Cheia obiectului e `petition_attachments.path`, în formatul de până acum
 * (`storageKey`), deci fișierele copiate din Supabase se găsesc sub cheile lor.
 *
 * Depozitul de fișiere vine ca parametru (`FileStore`), ca testele să-l poată
 * înlocui cu unul în memorie și să verifice ce rămâne în el după o eroare.
 */

import { asc, eq, sql } from "drizzle-orm";

import { NEAUTENTIFICAT, canModifyPetitionFiles, type Actor } from "@/lib/acl";
import { attachmentAudit, auditContext, auditInsert } from "@/lib/audit";
import { attachmentDisplayName, storageKey, validateAttachment, type AttachmentKind } from "@/lib/attachments";
import type { Db } from "@/lib/db";
import { petitionAttachments, petitions } from "@/lib/db/schema";
import type { PetitionAttachment } from "@/lib/types";
import { runBatch, type ActionResult } from "./common";

/** Ce folosim din R2; un `R2Bucket` îl îndeplinește întocmai. */
export interface FileStore {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface UploadInput {
  petitionId: string;
  kind: AttachmentKind;
  file: { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };
}

const FARA_DREPT_FISIER = "Fișier inexistent sau fără permisiune.";

/** Fișierele unei petiții, în ordinea atașării. Orice om conectat le vede. */
export async function listAttachments(db: Db, me: Actor | null, petitionId: string): Promise<PetitionAttachment[]> {
  if (!me) return [];
  const rows = await db
    .select()
    .from(petitionAttachments)
    .where(eq(petitionAttachments.petition_id, petitionId))
    .orderBy(asc(petitionAttachments.created_at), sql`${petitionAttachments}.rowid`);
  return rows as PetitionAttachment[];
}

/**
 * Atașează un fișier: R2 întâi, D1 după.
 *
 * Ordinea contează. Un rând fără obiect ar fi un link mort în listă; un obiect
 * fără rând e doar un fișier nevăzut — și chiar și pe acela îl ștergem dacă
 * scrierea în D1 cade, ca să nu rămână orfani.
 *
 * Fără notificare: scanarea se atașează imediat după înregistrare, deci ar
 * dubla „Petiție nouă" la fiecare petiție.
 */
export async function uploadAttachment(
  db: Db,
  files: FileStore,
  me: Actor | null,
  input: UploadInput,
): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  if (input.kind !== "petitie" && input.kind !== "raspuns") return { error: "Tip de fișier necunoscut." };
  // Aceleași limite ca bucketul `petitions` (0013): verificate și în browser,
  // dar acolo doar ca omul să afle repede — poarta e aici.
  const invalid = validateAttachment(input.file);
  if (invalid) return { error: invalid };

  const petition = await db.select().from(petitions).where(eq(petitions.id, input.petitionId)).get();
  if (!petition || !canModifyPetitionFiles(me, petition)) {
    return { error: "Petiție inexistentă sau fără permisiune." };
  }

  const count = await db
    .select({ n: sql<number>`count(*)` })
    .from(petitionAttachments)
    .where(eq(petitionAttachments.petition_id, petition.id))
    .get();
  const ctx = auditContext(me);
  const row = {
    id: crypto.randomUUID(),
    petition_id: petition.id,
    kind: input.kind,
    path: storageKey(petition.id, input.file.name),
    // Numele afișat/descărcat e generat automat; indicele ține cont de toate
    // fișierele petiției, ca două scanări să nu ajungă cu același nume.
    name: attachmentDisplayName(petition.number, petition.petitioner, input.file.name, (count?.n ?? 0) + 1),
    mime: input.file.type,
    size: input.file.size,
    uploaded_by: me.id,
    created_at: ctx.at,
  };

  await files.put(row.path, await input.file.arrayBuffer(), { httpMetadata: { contentType: row.mime } });
  try {
    await runBatch(db, [
      db.insert(petitionAttachments).values(row),
      auditInsert(db, ctx, [attachmentAudit("INSERT", row, petition.number)]),
    ]);
  } catch (e) {
    // Rândul n-a intrat → scoatem obiectul, fără orfani.
    await files.delete(row.path).catch(() => {});
    return { error: e instanceof Error ? e.message : "Fișierul n-a putut fi înregistrat." };
  }
  return { success: true };
}

export async function deleteAttachment(
  db: Db,
  files: FileStore,
  me: Actor | null,
  id: string,
): Promise<ActionResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  const row = await db.select().from(petitionAttachments).where(eq(petitionAttachments.id, id)).get();
  if (!row) return { error: FARA_DREPT_FISIER };
  const petition = await db.select().from(petitions).where(eq(petitions.id, row.petition_id)).get();
  if (!petition || !canModifyPetitionFiles(me, petition)) return { error: FARA_DREPT_FISIER };

  await runBatch(db, [
    db.delete(petitionAttachments).where(eq(petitionAttachments.id, id)),
    auditInsert(db, auditContext(me), [attachmentAudit("DELETE", row, petition.number)]),
  ]);
  // Rândul a dispărut → scoatem și obiectul, ca să nu rămână orfan.
  await removeObjects(files, [row.path]);
  return { success: true };
}

/**
 * Fișierul de servit pentru o cheie, sau `null`.
 *
 * Doar chei care au rând în `petition_attachments`: ruta de descărcare nu e o
 * fereastră spre tot bucketul, ci spre fișierele pe care aplicația le arată.
 * Citirea e a oricărui om conectat, ca regula „petitions bucket select".
 */
export async function attachmentForDownload(
  db: Db,
  files: FileStore,
  me: Actor | { id: string } | null,
  path: string,
) {
  if (!me) return null;
  const row = await db.select().from(petitionAttachments).where(eq(petitionAttachments.path, path)).get();
  if (!row) return null;
  const object = await files.get(row.path);
  if (!object) return null;
  return { row, object };
}

/** Șterge obiectele din R2; o eroare aici nu desface o ștergere deja făcută în bază. */
export async function removeObjects(files: FileStore, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await files.delete(keys);
  } catch {
    // Cel mult rămâne un fișier nevăzut în bucket; rândul lui nu mai există.
  }
}
