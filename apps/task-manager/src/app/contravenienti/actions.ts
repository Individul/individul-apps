"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prescriptieOf, validateContravener, type ContravenerInput } from "@/lib/contraveners";
import { todayInChisinau, toISODate } from "@/lib/periods";

type Result = { error?: string; success?: boolean };

export async function saveContravener(
  id: string | null,
  input: ContravenerInput,
): Promise<Result> {
  // Poarta reală e aici, nu în formular: o acțiune de server se poate chema
  // și fără el. Ziua de azi e a Chișinăului — serverul merge pe UTC, iar o
  // executare trecută azi la 1 noaptea ar fi fost respinsă drept „în viitor".
  const problem = validateContravener(input, toISODate(todayInChisinau()));
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
    executed_on: input.executed_on ? input.executed_on : null,
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

/**
 * Bifează (sau scoate) informarea despre prescripție ca expediată.
 *
 * Starea se verifică aici, din rândul citit acum, nu din ce avea browserul pe
 * ecran: între timp cineva poate să fi trecut data executării sau să fi
 * corectat data definitivă, iar o informare bifată pe o hotărâre care nu e
 * prescrisă ar spune în registru că s-a trimis o hârtie care n-avea temei.
 * Scoaterea bifei merge oricând — e felul de a îndrepta o apăsare greșită.
 */
export async function setContravenerInformed(id: string, informed: boolean): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  if (informed) {
    const { data: rand, error: eCitire } = await supabase
      .from("contraveners")
      .select("final_date, executed_on, informed_at")
      .eq("id", id)
      .maybeSingle();
    if (eCitire) return { error: eCitire.message };
    if (!rand) {
      return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
    }
    const p = prescriptieOf(rand, toISODate(todayInChisinau()));
    if (p.stare !== "prescris") {
      return {
        error:
          p.stare === "executat"
            ? "Arestul e trecut ca executat, deci nu e nimic de informat."
            : "Termenul de executare încă n-a expirat. Reîncarcă pagina.",
      };
    }
  }

  const { data, error } = await supabase
    .from("contraveners")
    .update(
      informed
        ? { informed_at: new Date().toISOString(), informed_by: userId, updated_by: userId }
        : { informed_at: null, informed_by: null, updated_by: userId },
    )
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/contravenienti");
  return { success: true };
}
