"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function signInWithMagicLink(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Introdu o adresă de email." };

  const supabase = createClient();
  const origin = headers().get("origin") ?? "";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // invite-only: nu crea utilizatori noi la login. Doar userii adăugați manual
    // în Supabase (Authentication → Users) pot primi link de acces. Backstop în cod
    // pentru cazul în care toggle-ul "Enable email signups" nu e dezactivat în dashboard.
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: false },
  });
  if (error) return { error: error.message };
  return { success: true };
}
