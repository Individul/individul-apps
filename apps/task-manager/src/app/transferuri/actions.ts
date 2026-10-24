"use server";

/** Acțiunile transferurilor: legătura dintre cerere și `lib/data/transfers.ts`. */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/transfers";
import type { TransferInput } from "@/lib/data/transfers";

export type { TransferInput } from "@/lib/data/transfers";

type Result = { error?: string; success?: boolean };

/** Registrul și cardul de pe pagina principală arată aceleași cifre. */
function revalidate() {
  revalidatePath("/transferuri");
  revalidatePath("/");
}

export async function createTransfer(input: TransferInput): Promise<Result> {
  const res = await data.createTransfer(getDb(), await getActor(), input);
  if (res.success) revalidate();
  return res;
}

export async function updateTransfer(id: string, input: TransferInput): Promise<Result> {
  const res = await data.updateTransfer(getDb(), await getActor(), id, input);
  if (res.success) revalidate();
  return res;
}

export async function deleteTransfer(id: string): Promise<Result> {
  const res = await data.deleteTransfer(getDb(), await getActor(), id);
  if (res.success) revalidate();
  return res;
}
