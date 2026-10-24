import bcrypt from "bcryptjs";

/**
 * Parolele: bcrypt, ca în Supabase.
 *
 * Amprentele importate din `auth.users` sunt `$2a$10$…`, iar `bcryptjs` le
 * verifică întocmai — de aceea parolele vechi merg fără ca cineva să le
 * reintroducă. Costul 10 e al lor; parolele noi îl păstrează, ca toate
 * amprentele să coste la fel la verificare (~50–100 ms de procesor pe Worker).
 */
const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/**
 * Amprentă cu care se compară când contul nu există.
 *
 * Fără ea, „nume greșit" ar răspunde instant, iar „parolă greșită" după o
 * verificare bcrypt — diferența de timp ar spune din afară ce nume există.
 * Calculată o dată, la prima nevoie.
 */
let decoy: Promise<string> | null = null;

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash || !hash.startsWith("$2")) {
    decoy ??= bcrypt.hash("parolă-inexistentă", COST);
    await bcrypt.compare(plain, await decoy);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
