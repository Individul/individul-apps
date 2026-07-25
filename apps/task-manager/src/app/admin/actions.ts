"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setUserRole(
  userId: string,
  role: "admin" | "member",
): Promise<{ error?: string; success?: boolean }> {
  if (role !== "admin" && role !== "member") return { error: "Rol invalid." };
  const supabase = createClient();

  // Nu-ți poți retrograda propriul rol (protecție și în cod, nu doar în UI).
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user?.id === userId && role === "member") {
    return { error: "Nu-ți poți retrograda propriul rol." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Fără permisiune sau utilizator inexistent." };
  revalidatePath("/admin");
  revalidatePath("/tasks");
  return { success: true };
}
