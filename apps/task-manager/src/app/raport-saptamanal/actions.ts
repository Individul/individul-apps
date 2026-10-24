"use server";

/** Eliberările din raportul săptămânal: legătura cu `lib/data/releases.ts`. */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/releases";

type Result = { error?: string; success?: boolean };

export async function saveRelease(date: string, count: unknown, note: string): Promise<Result> {
  const res = await data.saveRelease(getDb(), await getActor(), date, count, note);
  if (res.success) revalidatePath("/raport-saptamanal");
  return res;
}
