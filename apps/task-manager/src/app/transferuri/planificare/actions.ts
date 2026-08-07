"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCourt } from "@/lib/courts";
import { INSTITUTIONS } from "@/lib/transfers";

type Result = { error?: string; success?: boolean };

export interface PlanInput {
  last_name: string;
  first_name: string;
  court: string;
  institution: string;
  hearing_date: string;
  note: string;
}

function validate(input: PlanInput): string | null {
  if (!input.last_name.trim()) return "Numele e obligatoriu.";
  if (!input.first_name.trim()) return "Prenumele e obligatoriu.";
  // Lista de instanțe e fixă în interfață; verificată și aici, fiindcă acțiunea
  // poate fi apelată și altfel decât prin formular.
  if (!isCourt(input.court)) return "Alege instanța din listă.";
  if (!INSTITUTIONS.includes(Number(input.institution))) return "Alege penitenciarul.";
  if (!input.hearing_date) return "Data ședinței e obligatorie.";
  return null;
}

export async function savePlan(id: string | null, input: PlanInput): Promise<Result> {
  const problem = validate(input);
  if (problem) return { error: problem };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const values = {
    last_name: input.last_name.trim(),
    first_name: input.first_name.trim(),
    court: input.court,
    institution: Number(input.institution),
    hearing_date: input.hearing_date,
    note: input.note.trim() ? input.note.trim() : null,
    updated_by: userId,
  };

  // `.select()` pe update, ca peste tot: un rând dispărut (șters de altcineva
  // cât era dialogul deschis) nu produce eroare, doar zero rânduri — iar fără
  // verificare am spune „Însemnare salvată." despre nimic.
  const { data, error } = id
    ? await supabase.from("transfer_plans").update(values).eq("id", id).select()
    : await supabase.from("transfer_plans").insert({ ...values, created_by: userId }).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/transferuri/planificare");
  return { success: true };
}

/** Încheiat după ședință: iese din listă, dar rămâne în evidență. */
export async function setPlanDone(id: string, done: boolean): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data, error } = await supabase
    .from("transfer_plans")
    .update({ done, updated_by: userId })
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/transferuri/planificare");
  return { success: true };
}

export async function deletePlan(id: string): Promise<Result> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transfer_plans")
    .delete()
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Însemnarea nu există sau nu ai dreptul." };
  revalidatePath("/transferuri/planificare");
  return { success: true };
}
