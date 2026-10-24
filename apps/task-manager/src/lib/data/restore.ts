/**
 * Restaurarea non-distructivă a fișierelor vechi (`version: 1`): adaugă doar
 * rândurile lipsă, fără să șteargă sau să suprascrie ceva. Doar admin.
 *
 * Fiecare rând adăugat intră în jurnal ca o inserare, cum îl trecea triggerul;
 * o sarcină restaurată „Gata" primește `completed_at` de acum, cum i-l punea
 * `tasks_completed_at` la inserare.
 */

import { NEAUTENTIFICAT, canBackup, type Actor } from "@/lib/acl";
import { auditContext, auditInsert, commentAudit, tagAudit, taskAudit, taskTagAudit } from "@/lib/audit";
import type { Db } from "@/lib/db";
import { comments, tags, taskTags, tasks } from "@/lib/db/schema";
import { restoreRefusal } from "@/lib/backup";

type Row = Record<string, unknown>;
type RestoreResult = {
  error?: string;
  inserted?: { tasks: number; tags: number; task_tags: number; comments: number };
};

/** Doar coloanele pe care le are tabelul: un câmp necunoscut ar pica inserarea. */
function pick<T extends Record<string, unknown>>(row: Row, columns: readonly string[]): T {
  return Object.fromEntries(columns.filter((c) => c in row).map((c) => [c, row[c]])) as T;
}

const TASK_COLUMNS = [
  "id", "title", "description", "status", "priority", "due_date", "assignee_id", "created_by",
  "created_at", "updated_at", "waiting_since", "completed_at", "appealed_csj",
] as const;

export async function restoreBackup(db: Db, me: Actor | null, payload: unknown): Promise<RestoreResult> {
  if (!me) return { error: NEAUTENTIFICAT };
  if (!canBackup(me)) return { error: "Doar adminul poate restaura." };

  // Aceeași verificare e și în componentă, ca omul s-o afle înainte de
  // confirmare. Aici e ușa propriu-zisă: acțiunea scrie în baza de date, deci
  // ea trebuie să refuze formatul pe care nu-l poate importa întreg.
  const refusal = restoreRefusal(payload);
  if (refusal) return { error: refusal };

  const d = ((payload as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;
  const list = (k: string) => (Array.isArray(d[k]) ? (d[k] as Row[]) : null);
  const taskRows = list("tasks");
  if (!taskRows) return { error: "Fișier de backup invalid (lipsește data.tasks)." };

  const ctx = auditContext(me);
  const inserted = { tasks: 0, tags: 0, task_tags: 0, comments: 0 };

  // Ordine pentru chei străine: tags -> tasks -> task_tags -> comments. Câte
  // un rând pe rând: `on conflict do nothing` + `returning` spune exact care
  // au intrat, deci jurnalul nu minte despre cele care existau deja.
  try {
    for (const r of list("tags") ?? []) {
      const row = pick<typeof tags.$inferInsert>(r, ["id", "name", "color"]);
      const got = await db.insert(tags).values(row).onConflictDoNothing().returning();
      if (got[0]) {
        inserted.tags++;
        await auditInsert(db, ctx, [tagAudit("INSERT", got[0])]);
      }
    }
    for (const r of taskRows) {
      const row = pick<typeof tasks.$inferInsert>(r, TASK_COLUMNS);
      if (row.status === "done") row.completed_at = ctx.at;
      const got = await db.insert(tasks).values(row).onConflictDoNothing().returning();
      if (got[0]) {
        inserted.tasks++;
        await auditInsert(db, ctx, [taskAudit("INSERT", null, got[0], () => null)]);
      }
    }
    for (const r of list("task_tags") ?? []) {
      const row = pick<typeof taskTags.$inferInsert>(r, ["task_id", "tag_id"]);
      const got = await db.insert(taskTags).values(row).onConflictDoNothing().returning();
      if (got[0]) {
        inserted.task_tags++;
        await auditInsert(db, ctx, [taskTagAudit("INSERT", got[0])]);
      }
    }
    for (const r of list("comments") ?? []) {
      const row = pick<typeof comments.$inferInsert>(r, ["id", "task_id", "author_id", "body", "created_at"]);
      const got = await db.insert(comments).values(row).onConflictDoNothing().returning();
      if (got[0]) {
        inserted.comments++;
        await auditInsert(db, ctx, [commentAudit("INSERT", got[0])]);
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Restaurarea a eșuat.", inserted };
  }
  return { inserted };
}
