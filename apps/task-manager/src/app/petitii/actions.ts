"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyPetition } from "@/lib/notify-petition";
import { STATUS_LABEL } from "@/components/petitions/meta";
import type { PetitionStatus, PetitionerType } from "@/lib/types";

type Result = { error?: string; success?: boolean };
/** La creare întoarcem și identitatea rândului, ca dialogul să treacă direct
 *  în modul editare și să permită atașarea fișierelor fără a fi redeschis. */
type CreateResult = Result & { id?: string; number?: string };

export interface PetitionInput {
  petitioner: string;
  petitioner_type: PetitionerType;
  subject: string;
  received_date: string;
  assignee_id: string;
  status: PetitionStatus;
  response: string;
  response_date: string;
}

// Data curentă în fusul local (nu UTC) — altfel seara/noaptea ar cădea pe altă zi.
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yearSuffix(dateStr: string): string {
  const y = (dateStr || "").slice(0, 4);
  return (y || String(new Date().getFullYear())).slice(-2);
}

function normalize(input: PetitionInput) {
  return {
    petitioner: input.petitioner.trim(),
    petitioner_type: input.petitioner_type,
    subject: input.subject.trim() ? input.subject.trim() : null,
    received_date: input.received_date || new Date().toISOString().slice(0, 10),
    status: input.status,
    response: input.response.trim() ? input.response.trim() : null,
    response_date: input.response_date ? input.response_date : null,
    assignee_id: input.assignee_id ? input.assignee_id : null,
  };
}

export async function createPetition(
  numberPrefix: string,
  input: PetitionInput,
): Promise<CreateResult> {
  const prefix = numberPrefix.trim();
  if (!prefix) return { error: "Numărul de înregistrare e obligatoriu." };
  if (!input.petitioner.trim()) return { error: "Petiționarul e obligatoriu." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const nt = normalize(input);
  const number = `${prefix}/${yearSuffix(nt.received_date)}`;
  const { data, error } = await supabase
    .from("petitions")
    .insert({ ...nt, number, created_by: userId })
    .select("id, number")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "Există deja o petiție cu acest număr." };
    }
    return { error: error.message };
  }
  const ref = {
    id: data.id as string,
    number: data.number as string,
    assignee_id: nt.assignee_id,
    created_by: userId,
  };
  // Adminii află de orice petiție nouă, chiar dacă autorul și-a atribuit-o singur.
  await notifyPetition("created", ref, userId);
  if (nt.assignee_id) {
    // Adminii au primit deja „created" pentru aceeași acțiune — fără copie dublă.
    await notifyPetition("assigned", ref, userId, undefined, false);
  }

  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true, id: ref.id, number: ref.number };
}

export async function updatePetition(
  id: string,
  number: string,
  input: PetitionInput,
): Promise<Result> {
  if (!number.trim()) return { error: "Numărul de înregistrare e obligatoriu." };
  if (!input.petitioner.trim()) return { error: "Petiționarul e obligatoriu." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const nt = normalize(input);

  // Starea de dinainte, ca notificarea să spună ce anume s-a schimbat.
  const { data: prev } = await supabase
    .from("petitions")
    .select("assignee_id, status, created_by")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("petitions")
    .update({ ...nt, number: number.trim() })
    .eq("id", id)
    .select();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "Există deja o petiție cu acest număr." };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) return { error: "Petiție inexistentă sau fără permisiune." };

  if (prev && userId) {
    const ref = {
      id,
      number: number.trim(),
      assignee_id: nt.assignee_id,
      created_by: prev.created_by as string,
    };
    if (nt.assignee_id && nt.assignee_id !== prev.assignee_id) {
      await notifyPetition("assigned", ref, userId);
    } else if (nt.status !== prev.status) {
      await notifyPetition("status", ref, userId, STATUS_LABEL[nt.status]);
    } else {
      await notifyPetition("edited", ref, userId);
    }
  }

  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}

export async function deletePetition(id: string): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  // Datele se citesc înainte: după ștergere nu mai există de unde compune mesajul.
  const { data: prev } = await supabase
    .from("petitions")
    .select("number, assignee_id, created_by")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase.from("petitions").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Petiție inexistentă sau fără permisiune." };

  if (prev && userId) {
    await notifyPetition(
      "deleted",
      {
        id,
        number: prev.number as string,
        assignee_id: prev.assignee_id as string | null,
        created_by: prev.created_by as string,
      },
      userId,
    );
  }

  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}

// Finalizare rapidă: trece petiția în „Soluționat" și completează data
// răspunsului cu ziua curentă dacă lipsește. Dreptul e impus de RLS
// (admin / creator / responsabil) — dacă lipsește, update-ul atinge 0 rânduri.
export async function finalizePetition(id: string): Promise<Result> {
  const supabase = createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: prev } = await supabase
    .from("petitions")
    .select("response_date, number, assignee_id, created_by")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("petitions")
    .update({
      status: "solutionat",
      response_date: (prev?.response_date as string | null) ?? todayLocal(),
    })
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Petiție inexistentă sau fără permisiune." };

  if (prev && userId) {
    await notifyPetition(
      "status",
      {
        id,
        number: prev.number as string,
        assignee_id: prev.assignee_id as string | null,
        created_by: prev.created_by as string,
      },
      userId,
      STATUS_LABEL.solutionat,
    );
  }

  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}
