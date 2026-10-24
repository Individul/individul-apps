"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as account from "@/lib/data/account";
import * as restore from "@/lib/data/restore";
import { NEAUTENTIFICAT, canBackup } from "@/lib/acl";
import { backupMode, runNightlyBackup, type BackupSummary } from "@/lib/backup-run";

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/sarcini");
}

export async function setUserRole(
  userId: string,
  role: "admin" | "member",
): Promise<{ error?: string; success?: boolean }> {
  const res = await account.setUserRole(getDb(), await getActor(), userId, role);
  if (res.success) refresh();
  return res;
}

/**
 * Restaurare non-distructivă a fișierelor vechi (`version: 1`). Fișierele de
 * azi sunt refuzate — vezi `restoreRefusal` pentru motiv.
 */
export async function restoreBackup(payload: unknown): Promise<{
  error?: string;
  inserted?: { tasks: number; tags: number; task_tags: number; comments: number };
}> {
  const res = await restore.restoreBackup(getDb(), await getActor(), payload);
  if (!res.error) refresh();
  return res;
}

// Creează un utilizator cu username + parolă (fără email real — se folosește un
// email intern). Doar admin.
export async function createUser(input: {
  full_name: string;
  username: string;
  password: string;
}): Promise<{ error?: string; success?: boolean }> {
  const res = await account.createUser(getDb(), await getActor(), input);
  if (res.success) refresh();
  return res;
}

/** Copia, acum, la cererea adminului — aceeași funcție pe care o cheamă cronul. */
export async function runBackupNow(): Promise<BackupSummary | { error: string }> {
  const me = await getActor();
  if (!me) return { error: NEAUTENTIFICAT };
  if (!canBackup(me)) return { error: "Doar adminul poate porni copia." };
  const { env } = getCloudflareContext();
  const summary = await runNightlyBackup({
    db: getDb(),
    files: env.FISIERE,
    mode: backupMode(env.BACKUP_MODE),
    force: true,
  });
  revalidatePath("/admin");
  return summary;
}
