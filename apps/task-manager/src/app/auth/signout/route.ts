import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Ieșirea: sesiunea se șterge din D1, nu doar cookie-ul din browser — un
 * cookie copiat înainte nu mai deschide nimic după.
 */
export async function POST(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  await deleteSession(getDb(), token ? decodeURIComponent(token) : undefined);

  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/login`, { status: 302 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
