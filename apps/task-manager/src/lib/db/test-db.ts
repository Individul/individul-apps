/**
 * O bază D1 proaspătă pentru teste: runtime-ul local al lui wrangler, în
 * memorie, cu migrările din `migrations/` aplicate.
 *
 * D1 adevărat, nu un SQLite de împrumut: regulile pe care le testăm (chei
 * străine, `check`, coloane generate, `batch`) sunt fix cele care pot diferi
 * între motoare.
 */

import fs from "node:fs";
import path from "node:path";
import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";
import type { Db } from "./index";

const MIGRATIONS = path.join(process.cwd(), "migrations");

export async function createTestDb(): Promise<{ db: Db; d1: D1Database; dispose: () => Promise<void> }> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const d1 = proxy.env.DB;
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const text = fs.readFileSync(path.join(MIGRATIONS, file), "utf8");
    for (const statement of text.split("--> statement-breakpoint")) {
      if (statement.trim()) await d1.prepare(statement).run();
    }
  }
  return { db: drizzle(d1, { schema }), d1, dispose: () => proxy.dispose() };
}
