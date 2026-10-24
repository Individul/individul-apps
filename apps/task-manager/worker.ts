/**
 * Intrarea Worker-ului: aplicația Next (OpenNext) plus cronul copiei.
 *
 * Cronul cheamă copia direct, nu printr-o rută HTTP: pe Vercel ruta trebuia
 * apărată cu `CRON_SECRET`, fiindcă oricine o putea chema din afară. Un
 * handler `scheduled` nu are adresă, deci nu are ce apăra.
 */

import { drizzle } from "drizzle-orm/d1";

// @ts-ignore — fișier generat de `opennextjs-cloudflare build`; lipsește înainte de build.
import { default as nextHandler } from "./.open-next/worker.js";
import * as schema from "./src/lib/db/schema";
import { backupMode, runNightlyBackup } from "./src/lib/backup-run";

type Env = CloudflareEnv & { BACKUP_MODE?: string };

export default {
  fetch: nextHandler.fetch,

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const mode = backupMode(env.BACKUP_MODE);
    // În probă, cronul tace: copia de pe Vercel e încă cea adevărată, iar a
    // doua copie a nopții ar scrie peste ea. Butonul adminului merge oricum.
    if (mode !== "productie") return;
    ctx.waitUntil(
      runNightlyBackup({ db: drizzle(env.DB, { schema }), files: env.FISIERE, mode }).then((summary) =>
        // Ajunge în jurnalul Worker-ului (Observability), lângă rândul din `backup_runs`.
        console.log(JSON.stringify({ backup: summary })),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
