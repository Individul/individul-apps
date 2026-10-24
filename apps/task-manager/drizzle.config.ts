import { defineConfig } from "drizzle-kit";

// Doar pentru generarea migrărilor din schemă (`npx drizzle-kit generate`).
// Aplicarea o face wrangler: `npx wrangler d1 migrations apply sarcini`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./migrations",
});
