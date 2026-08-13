"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RELEASE_GROUNDS } from "@/lib/releases";

type Result = { error?: string; success?: boolean };

export interface ReleasePlanInput {
  id: string | null;
  last_name: string;
  first_name: string;
  release_date: string;
  ground: string;
  note: string;
}

const ZI = /^\d{4}-\d{2}-\d{2}$/;

function validate(input: ReleasePlanInput): string | null {
  if (!input.last_name.trim()) return "Numele e obligatoriu.";
  if (!input.first_name.trim()) return "Prenumele e obligatoriu.";
  // `in` peste hartă, nu o listă scrisă aici: un temei adăugat în
  // `RELEASE_GROUNDS` e primit fără a mai fi trecut și prin locul ăsta.
  if (!(input.ground in RELEASE_GROUNDS)) return "Alege temeiul din listă.";
  if (!ZI.test(input.release_date)) return "Data eliberării e obligatorie.";
  return null;
}

/*
 * Fiecare acțiune reîmprospătează și „/", nu doar „/eliberari": chenarul de pe
 * pagina de start citește aceleași rânduri, iar fără al doilea apel ar arăta
 * luna veche după fiecare modificare. Nu e o repetare de șters.
 */

export async function saveReleasePlan(input: ReleasePlanInput): Promise<Result> {
  const problem = validate(input);
  if (problem) return { error: problem };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const values = {
    last_name: input.last_name.trim(),
    first_name: input.first_name.trim(),
    release_date: input.release_date,
    ground: input.ground,
    note: input.note.trim() ? input.note.trim() : null,
    updated_by: userId,
  };

  // Data mutată șterge ștampila anunțului. Cine era programat pe 14 și trece pe
  // 20 n-a fost anunțat pentru 20, iar `notify_todays_releases()` sare peste
  // rândurile cu `notified_at` completat — deci ștampila rămasă ar amuți
  // anunțul pentru totdeauna, exact la eliberarea care s-a mișcat.
  let mutata = false;
  if (input.id) {
    const { data: acum } = await supabase
      .from("release_plans")
      .select("release_date")
      .eq("id", input.id)
      .maybeSingle();
    mutata = acum !== null && acum.release_date !== input.release_date;
  }

  // `.select()` pe update, ca peste tot: un rând dispărut (șters de altcineva
  // cât era dialogul deschis) nu produce eroare, doar zero rânduri.
  const { data, error } = input.id
    ? await supabase
        .from("release_plans")
        .update(mutata ? { ...values, notified_at: null } : values)
        .eq("id", input.id)
        .select()
    : await supabase
        .from("release_plans")
        .insert({ ...values, created_by: userId })
        .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/eliberari");
  revalidatePath("/");
  return { success: true };
}

/** S-a eliberat: iese din lista de lucru, dar rămâne în evidență. */
export async function setReleaseDone(id: string, done: boolean): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data, error } = await supabase
    .from("release_plans")
    .update({ done, updated_by: userId })
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/eliberari");
  revalidatePath("/");
  return { success: true };
}

export async function deleteReleasePlan(id: string): Promise<Result> {
  const supabase = createClient();
  const { data, error } = await supabase.from("release_plans").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Însemnarea nu există sau nu ai dreptul." };
  revalidatePath("/eliberari");
  revalidatePath("/");
  return { success: true };
}
