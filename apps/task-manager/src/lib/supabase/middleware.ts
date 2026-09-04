import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ANTET_SESIUNE } from "@/lib/session-header";


export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() must be called to refresh the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  /**
   * `/api/backup` e chemată de Vercel Cron, care trimite secretul într-un antet
   * și **niciun cookie**. Fără excepția asta, cererea e redirecționată la
   * `/login` înainte să ajungă la rută, iar copia de siguranță nu rulează
   * niciodată — tăcut, fiindcă un 307 nu e o eroare pentru nimeni.
   *
   * Ruta se apără singură, comparând `CRON_SECRET`, și refuză să pornească dacă
   * secretul nu e configurat. Excepția e scrisă pe cale exactă, nu pe `/api`:
   * altfel orice rută API adăugată mai târziu ar deveni publică din neatenție.
   */
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname === "/api/backup";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  /**
   * Un indiciu pentru layout: are cererea o sesiune sau nu.
   *
   * Doar de desen. Layout-ul îl citește ca să știe dacă să rezerve locul barei
   * de sus înainte de a afla cine e conectat — altfel pe pagina de autentificare
   * ar clipi o bară care apoi dispare. Cine e omul se află tot din Supabase, în
   * componenta barei; aici nu trece nicio identitate.
   *
   * Se scrie MEREU, și pe „0". Așa, un antet cu același nume venit din afară nu
   * poate supraviețui: e suprascris la fiecare cerere.
   */
  const antete = new Headers(request.headers);
  antete.set(ANTET_SESIUNE, user ? "1" : "0");
  const raspuns = NextResponse.next({ request: { headers: antete } });
  supabaseResponse.cookies.getAll().forEach((c) => raspuns.cookies.set(c));
  return raspuns;
}
