"use server";

/**
 * Acțiunile petițiilor: legătura dintre cerere și `lib/data/petitions.ts`.
 *
 * Aici stau doar cine e conectat și ce pagini se reîmprospătează. Dreptul,
 * jurnalul și notificările sunt ale modulului de date, unde se testează.
 */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/petitions";
import { getFileStore } from "@/lib/storage";

export type { PetitionInput } from "@/lib/data/petitions";

type Result = { error?: string; success?: boolean };

function refresh() {
  revalidatePath("/petitii");
  revalidatePath("/");
}

export async function createPetition(
  numberPrefix: string,
  input: data.PetitionInput,
): Promise<data.CreatePetitionResult> {
  const res = await data.createPetition(getDb(), await getActor(), numberPrefix, input);
  if (res.success) refresh();
  return res;
}

export async function updatePetition(id: string, number: string, input: data.PetitionInput): Promise<Result> {
  const res = await data.updatePetition(getDb(), await getActor(), id, number, input);
  if (res.success) refresh();
  return res;
}

export async function deletePetition(id: string): Promise<Result> {
  const res = await data.deletePetition(getDb(), getFileStore(), await getActor(), id);
  if (res.success) refresh();
  return res;
}

export async function finalizePetition(id: string): Promise<Result> {
  const res = await data.finalizePetition(getDb(), await getActor(), id);
  if (res.success) refresh();
  return res;
}
