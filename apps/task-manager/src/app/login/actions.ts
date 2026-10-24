"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getDb } from "@/lib/db";
import { checkLogin } from "@/lib/auth/login";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { sessionCookieOptions } from "@/lib/auth/server";

/**
 * Limita de încercări, pe adresa de unde vine cererea.
 *
 * Lipsește sub `next dev` (legătura există doar în Worker); acolo nu se
 * limitează nimic, iar asta e bine: local nu ghicește nimeni parole.
 */
async function tooManyAttempts(): Promise<boolean> {
  const limit = getCloudflareContext().env.LOGIN_LIMIT;
  if (!limit) return false;
  const ip = (await headers()).get("cf-connecting-ip") ?? "necunoscut";
  const { success } = await limit.limit({ key: `login:${ip}` });
  return !success;
}

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

  if (await tooManyAttempts()) {
    return { error: "Prea multe încercări. Așteaptă un minut și încearcă din nou.", identifier };
  }

  const db = getDb();
  const result = await checkLogin(db, identifier, password);
  if ("error" in result) return { ...result, identifier };

  const { token, expiresAt } = await createSession(db, result.userId);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  redirect("/");
}
