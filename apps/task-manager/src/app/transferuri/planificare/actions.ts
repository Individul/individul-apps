"use server";

/** Acțiunile planificării: legătura dintre cerere și `lib/data/transfer-plans.ts`. */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/transfer-plans";
import type { PlanInput } from "@/lib/data/transfer-plans";

export type { PlanInput } from "@/lib/data/transfer-plans";

type Result = { error?: string; success?: boolean };

const PAGINA = "/transferuri/planificare";

export async function savePlan(id: string | null, input: PlanInput): Promise<Result> {
  const res = await data.savePlan(getDb(), await getActor(), id, input);
  if (res.success) revalidatePath(PAGINA);
  return res;
}

export async function setPlanDone(id: string, done: boolean): Promise<Result> {
  const res = await data.setPlanDone(getDb(), await getActor(), id, done);
  if (res.success) revalidatePath(PAGINA);
  return res;
}

export async function setPlanNotified(id: string, notified: boolean): Promise<Result> {
  const res = await data.setPlanNotified(getDb(), await getActor(), id, notified);
  if (res.success) revalidatePath(PAGINA);
  return res;
}

export async function deletePlan(id: string): Promise<Result> {
  const res = await data.deletePlan(getDb(), await getActor(), id);
  if (res.success) revalidatePath(PAGINA);
  return res;
}
