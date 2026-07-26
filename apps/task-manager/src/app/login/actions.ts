"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInWithPassword(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Introdu email și parolă." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Mesaj generic intenționat: nu dezvăluim dacă emailul există sau nu.
  if (error) return { error: "Email sau parolă incorecte." };

  redirect("/tasks");
}
