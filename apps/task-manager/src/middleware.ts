import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { DOAR_CITIRE, MESAJ_DOAR_CITIRE } from "@/lib/doar-citire";

export async function middleware(request: NextRequest) {
  // Orice scriere trece printr-un POST (acțiunile de server, încărcările), deci
  // aici se oprește tot ce ar schimba date. Logarea și ieșirea rămân: nu scriu
  // nimic în registre, iar fără ele nici citirea n-ar mai fi posibilă.
  if (DOAR_CITIRE && request.method === "POST") {
    const { pathname } = request.nextUrl;
    if (!pathname.startsWith("/login") && pathname !== "/auth/signout") {
      return NextResponse.json({ error: MESAJ_DOAR_CITIRE }, { status: 503 });
    }
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
