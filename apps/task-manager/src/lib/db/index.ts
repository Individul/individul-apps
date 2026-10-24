import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

/** Baza D1 a cererii curente (legătura `DB` din wrangler.toml). */
export function getDb(): Db {
  return drizzle(getCloudflareContext().env.DB, { schema });
}

/**
 * O încălcare de unicitate, cum o raportează D1.
 *
 * În Postgres avea codul 23505; SQLite o spune doar în mesaj. Codul vechi
 * deosebea așa „există deja" de o eroare de sistem, deci criteriul trebuie să
 * rămână unul singur, aici.
 */
export function isUniqueViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);
  return text.includes("UNIQUE constraint failed");
}
