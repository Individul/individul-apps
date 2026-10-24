"use server";

/** Bifele informărilor periodice: legătura cu `lib/data/obligations.ts`. */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/obligations";

type Result = { error?: string; success?: boolean; removed?: string };

function revalidate() {
  revalidatePath("/obligatii");
  revalidatePath("/");
}

export async function markObligationDone(obligationId: string, dueDate: string): Promise<Result> {
  const res = await data.markObligationDone(getDb(), await getActor(), obligationId, dueDate);
  if (res.success) revalidate();
  return res;
}

export async function undoObligationDone(obligationId: string): Promise<Result> {
  const res = await data.undoObligationDone(getDb(), await getActor(), obligationId);
  if (res.success) revalidate();
  return res;
}
