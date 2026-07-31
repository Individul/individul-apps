import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  return supabaseResponse;
}
