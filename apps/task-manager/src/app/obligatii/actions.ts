"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; success?: boolean };

/**
 * Bifează un termen anume, nu „obligația".
 *
 * `due_date` vine din calcul, nu din ceasul apăsării: altfel o bifă pusă pe 2
 * septembrie n-ar spune dacă acoperă termenul din august sau pe cel din
 * septembrie — adică exact întrebarea la care evidența trebuie să răspundă.
 */
export async function markObligationDone(
  obligationId: string,
  dueDate: string,
): Promise<Result> {
  if (!obligationId || !dueDate) return { error: "Lipsește obligația sau termenul." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { error } = await supabase.from("obligation_completions").insert({
    obligation_id: obligationId,
    due_date: dueDate,
    completed_by: userId,
  });
  if (error) {
    // Doi oameni au bifat același termen în același moment.
    if ((error as { code?: string }).code === "23505") {
      return { error: "Termenul e deja bifat." };
    }
    return { error: error.message };
  }

  revalidatePath("/obligatii");
  revalidatePath("/");
  return { success: true };
}

/** Scoate o bifă pusă din greșeală; ștergerea rămâne în audit. */
export async function undoObligationDone(
  obligationId: string,
  dueDate: string,
): Promise<Result> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("obligation_completions")
    .delete()
    .eq("obligation_id", obligationId)
    .eq("due_date", dueDate)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Bifa nu mai există." };

  revalidatePath("/obligatii");
  revalidatePath("/");
  return { success: true };
}
