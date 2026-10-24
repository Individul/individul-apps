import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/lib/db/schema";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { ANTET_SESIUNE } from "@/lib/session-header";

/**
 * Poarta aplicației: fără sesiune valabilă, orice pagină trimite la /login.
 *
 * Sesiunea se verifică în D1, nu doar după prezența cookie-ului: un cookie
 * expirat sau al unei sesiuni închise ar lăsa altfel omul pe o pagină care
 * nu-l mai recunoaște. Tot aici se prelungește sesiunea folosită — singurul
 * loc care poate și trimite cookie-ul nou.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // Cronometrat: din browser se vede cât din așteptare e verificarea sesiunii
  // (Network → Timing), nu doar o singură cifră pentru toată cererea.
  const inceput = Date.now();
  let session = null;
  if (token) {
    const { env } = await getCloudflareContext({ async: true });
    session = await validateSession(drizzle(env.DB, { schema }), token, { renew: true });
  }
  const timing = `auth;dur=${Date.now() - inceput};desc="verificare sesiune"`;

  const isPublic = request.nextUrl.pathname.startsWith("/login");

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Un cookie care nu mai deschide nimic se șterge, ca să nu se tot verifice.
    if (token) redirect.cookies.delete(SESSION_COOKIE);
    redirect.headers.set("Server-Timing", timing);
    return redirect;
  }

  /*
   * Indiciul pentru layout: are cererea o sesiune sau nu. Doar de desen — cine
   * e omul se află tot din D1, în componenta barei. Se scrie mereu, și pe „0”,
   * ca un antet cu același nume venit din afară să nu supraviețuiască.
   */
  const antete = new Headers(request.headers);
  antete.set(ANTET_SESIUNE, session ? "1" : "0");
  const raspuns = NextResponse.next({ request: { headers: antete } });

  if (session?.renewed && token) {
    raspuns.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });
  }
  raspuns.headers.set("Server-Timing", timing);
  return raspuns;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
