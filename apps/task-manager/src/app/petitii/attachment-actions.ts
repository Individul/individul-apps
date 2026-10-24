"use server";

/**
 * Acțiunile fișierelor petițiilor: legătura dintre cerere și
 * `lib/data/attachments.ts`. Octeții merg în R2 prin server; browserul nu mai
 * vorbește direct cu depozitul de fișiere.
 */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/attachments";
import { getFileStore } from "@/lib/storage";
import type { AttachmentKind } from "@/lib/attachments";
import type { PetitionAttachment } from "@/lib/types";
import { sigur } from "@/lib/sigur";

type Result = { error?: string; success?: boolean };

export async function listAttachments(petitionId: string): Promise<PetitionAttachment[]> {
  return data.listAttachments(getDb(), await getActor(), petitionId);
}

/** Primește fișierul în `FormData`: `petitionId`, `kind`, `file`. */
export async function uploadAttachment(form: FormData): Promise<Result> {
  const file = form.get("file");
  if (!(file instanceof File)) return { error: "Niciun fișier primit." };
  const res = await sigur(async () =>
    data.uploadAttachment(getDb(), getFileStore(), await getActor(), {
      petitionId: String(form.get("petitionId") ?? ""),
      kind: String(form.get("kind") ?? "") as AttachmentKind,
      file,
    }),
  );
  if (res.success) revalidatePath("/petitii");
  return res;
}

export async function deleteAttachment(id: string): Promise<Result> {
  const res = await sigur(async () => data.deleteAttachment(getDb(), getFileStore(), await getActor(), id));
  if (res.success) revalidatePath("/petitii");
  return res;
}

/**
 * Adresa de deschidere a fișierului, prin ruta `/fisiere/…`, care verifică
 * sesiunea la fiecare cerere. Înlocuiește linkul semnat de 60 de secunde din
 * Supabase: aici nu e nimic de semnat, fiindcă ruta nu servește nimic fără
 * cookie-ul de sesiune.
 */
export async function getAttachmentUrl(
  path: string,
  downloadAs?: string,
): Promise<{ url?: string; error?: string }> {
  if (!(await getActor())) return { error: "Neautentificat." };
  const url = `/fisiere/${path.split("/").map(encodeURIComponent).join("/")}`;
  return { url: downloadAs ? `${url}?descarca=1` : url };
}
