"use server";

/** Acțiunile contravenienților: legătura cu `lib/data/contraveners.ts`. */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/contraveners";
import type { ContravenerInput } from "@/lib/contraveners";

type Result = { error?: string; success?: boolean };

export async function saveContravener(id: string | null, input: ContravenerInput): Promise<Result> {
  const res = await data.saveContravener(getDb(), await getActor(), id, input);
  if (res.success) revalidatePath("/contravenienti");
  return res;
}

export async function deleteContravener(id: string): Promise<Result> {
  const res = await data.deleteContravener(getDb(), await getActor(), id);
  if (res.success) revalidatePath("/contravenienti");
  return res;
}

export async function setContravenerInformed(id: string, informed: boolean): Promise<Result> {
  const res = await data.setContravenerInformed(getDb(), await getActor(), id, informed);
  if (res.success) revalidatePath("/contravenienti");
  return res;
}
