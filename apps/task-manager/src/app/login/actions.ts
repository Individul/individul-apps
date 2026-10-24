"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * `identifier` se întoarce la eroare: React 19 golește formularul după fiecare
 * trimitere, iar fără el omul care a greșit parola ar rescrie și numele.
 */
export async function signInWithPassword(
  _prev: { error?: string; identifier?: string } | null,
  formData: FormData,
): Promise<{ error?: string; identifier?: string }> {
  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");
  if (!identifier || !password) return { error: "Introdu email/username și parolă.", identifier };

  const supabase = await createClient();

  // Fără "@" => tratăm ca username și îl rezolvăm la emailul contului.
  let email = identifier;
  if (!identifier.includes("@")) {
    const { data, error } = await supabase.rpc("email_for_login", { identifier });
    if (error || !data) return { error: "Date de autentificare incorecte.", identifier };
    email = data as string;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Mesaj generic intenționat: nu dezvăluim ce email/username există.
  if (error) return { error: "Date de autentificare incorecte.", identifier };

  redirect("/");
}
