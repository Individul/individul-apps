"use server";

/** Acțiunile ședințelor: legătura dintre cerere și `lib/data/hearings.ts`. */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/hearings";
import type { HearingInput } from "@/lib/data/hearings";
import { sigur } from "@/lib/sigur";

export type { HearingInput } from "@/lib/data/hearings";

type Result = { error?: string; success?: boolean };

export async function saveHearing(input: HearingInput): Promise<Result> {
  const res = await sigur(async () => data.saveHearing(getDb(), await getActor(), input));
  if (res.success) revalidatePath("/sedinte");
  return res;
}
