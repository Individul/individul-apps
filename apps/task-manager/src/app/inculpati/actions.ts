"use server";

/** Acțiunile registrului de inculpați: legătura cu `lib/data/defendants.ts`. */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/defendants";
import type { DefendantInput } from "@/lib/data/defendants";

export type { DefendantInput } from "@/lib/data/defendants";

type Result = { error?: string; success?: boolean };

export async function saveDefendant(id: string | null, input: DefendantInput): Promise<Result> {
  const res = await data.saveDefendant(getDb(), await getActor(), id, input);
  if (res.success) revalidatePath("/inculpati");
  return res;
}

export async function markConvicted(id: string, convictedOn: string): Promise<Result> {
  const res = await data.markConvicted(getDb(), await getActor(), id, convictedOn);
  if (res.success) revalidatePath("/inculpati");
  return res;
}

export async function undoConvicted(id: string): Promise<Result> {
  const res = await data.undoConvicted(getDb(), await getActor(), id);
  if (res.success) revalidatePath("/inculpati");
  return res;
}

export async function deleteDefendant(id: string): Promise<Result> {
  const res = await data.deleteDefendant(getDb(), await getActor(), id);
  if (res.success) revalidatePath("/inculpati");
  return res;
}
