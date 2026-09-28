"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateContravener, type ContravenerInput } from "@/lib/contraveners";

type Result = { error?: string; success?: boolean };

export async function saveContravener(
  id: string | null,
  input: ContravenerInput,
): Promise<Result> {
  // Poarta reală e aici, nu în formular: o acțiune de server se poate chema
  // și fără el.
  const problem = validateContravener(input);
  if (problem) return { error: problem };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const values = {
    last_name: input.last_name.trim(),
    first_name: input.first_name.trim(),
    patronymic: input.patronymic.trim() ? input.patronymic.trim() : null,
    decision_date: input.decision_date,
    final_date: input.final_date ? input.final_date : null,
    arrest_days: Number(input.arrest_days.trim()),
    updated_by: userId,
  };

  // `.select()` pe ambele ramuri: un rând dispărut (șters de altcineva cât era
  // dialogul deschis) nu produce eroare, doar zero rânduri — iar fără
  // verificare am spune „Însemnare salvată." despre nimic.
  const { data, error } = id
    ? await supabase.from("contraveners").update(values).eq("id", id).select()
    : await supabase.from("contraveners").insert({ ...values, created_by: userId }).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/contravenienti");
  return { success: true };
}

export async function deleteContravener(id: string): Promise<Result> {
  const supabase = createClient();
  const { data, error } = await supabase.from("contraveners").delete().eq("id", id).select();
  if (error) return { error: error.message };
  // RLS lasă ștergerea doar adminului; celorlalți le întoarce zero rânduri, nu
  // o eroare — de aici mesajul care acoperă ambele cazuri.
  if (!data || data.length === 0) return { error: "Însemnarea nu există sau nu ai dreptul." };
  revalidatePath("/contravenienti");
  return { success: true };
}
