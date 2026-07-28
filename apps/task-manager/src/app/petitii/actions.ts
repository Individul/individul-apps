"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PetitionStatus, PetitionerType } from "@/lib/types";

type Result = { error?: string; success?: boolean };

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

export async function createPetition(numberPrefix: string, input: PetitionInput): Promise<Result> {
  const prefix = numberPrefix.trim();
  if (!prefix) return { error: "Numărul de înregistrare e obligatoriu." };
  if (!input.petitioner.trim()) return { error: "Petiționarul e obligatoriu." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const nt = normalize(input);
  const number = `${prefix}/${yearSuffix(nt.received_date)}`;
  const { error } = await supabase.from("petitions").insert({ ...nt, number, created_by: userId });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "Există deja o petiție cu acest număr." };
    }
    return { error: error.message };
  }
  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}

export async function updatePetition(
  id: string,
  number: string,
  input: PetitionInput,
): Promise<Result> {
  if (!number.trim()) return { error: "Numărul de înregistrare e obligatoriu." };
  if (!input.petitioner.trim()) return { error: "Petiționarul e obligatoriu." };

  const supabase = createClient();
  const nt = normalize(input);
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
  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}

export async function deletePetition(id: string): Promise<Result> {
  const supabase = createClient();
  const { data, error } = await supabase.from("petitions").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Petiție inexistentă sau fără permisiune." };
  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}

// Finalizare rapidă: trece petiția în „Soluționat" și completează data
// răspunsului cu ziua curentă dacă lipsește. Dreptul e impus de RLS
// (admin / creator / responsabil) — dacă lipsește, update-ul atinge 0 rânduri.
export async function finalizePetition(id: string): Promise<Result> {
  const supabase = createClient();

  const { data: prev } = await supabase
    .from("petitions")
    .select("response_date")
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

  revalidatePath("/petitii");
  revalidatePath("/");
  return { success: true };
}
