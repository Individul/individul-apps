import type { Db } from "@/lib/db";
import { verifyPassword } from "./password";
import { findLoginUser } from "./session";

/** Mesaj generic intenționat: nu dezvăluim ce email/username există. */
export const DATE_GRESITE = "Date de autentificare incorecte.";

/**
 * Verifică numele (sau adresa) și parola. Întoarce contul, fără să deschidă
 * sesiunea — asta o face acțiunea, care poate scrie cookie-ul.
 */
export async function checkLogin(
  db: Db,
  identifier: string,
  password: string,
): Promise<{ userId: string } | { error: string }> {
  if (!identifier.trim() || !password) return { error: "Introdu email/username și parolă." };
  const user = await findLoginUser(db, identifier);
  // Și pentru un nume inexistent se face o verificare bcrypt întreagă: altfel
  // timpul răspunsului ar spune din afară care nume există.
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok) return { error: DATE_GRESITE };
  return { userId: user.id };
}
