/**
 * Logarea văzută din Next: cookie-ul, cine e conectat, cine are voie.
 *
 * Doar pentru server. Logica propriu-zisă stă în `session.ts`, fără Next.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import type { Actor } from "@/lib/acl";
import { SESSION_COOKIE, validateSession } from "./session";

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    // Pe `next dev` (http://localhost) Chrome acceptă oricum cookie-uri
    // `secure`, dar alte browsere nu; în producție e mereu HTTPS.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/**
 * Id-ul celui conectat, sau `null`.
 *
 * `cache` îl face să coste o singură citire din D1 pe randare, oricâte
 * componente îl cer. Între cereri nu păstrează nimic, deci nimeni nu primește
 * identitatea altuia.
 */
export const getCurrentUserId = cache(async function getCurrentUserId(): Promise<string | null> {
  const session = await validateSession(getDb(), await getSessionToken());
  return session?.userId ?? null;
});

/**
 * Cine face acțiunea: id, nume (pentru jurnal) și dacă e admin.
 *
 * Fiecare acțiune de server începe de aici. În Supabase poarta era baza —
 * regulile RLS refuzau singure o scriere fără drept. Pe D1 nu mai există
 * poartă în bază, deci o acțiune care nu cere `Actor` nu verifică nimic.
 */
export const getActor = cache(async function getActor(): Promise<Actor | null> {
  const id = await getCurrentUserId();
  if (!id) return null;
  const profile = await getDb()
    .select({ full_name: profiles.full_name, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, id))
    .get();
  return { id, name: profile?.full_name ?? null, isAdmin: profile?.role === "admin" };
});
