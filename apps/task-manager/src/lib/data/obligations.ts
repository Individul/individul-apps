/**
 * Informările periodice — bifele termenelor (0023), pe D1.
 *
 * Regula din bază: orice om conectat bifează și debifează un termen; obligațiile
 * însele le definește doar adminul (aplicația nu are încă formular pentru ele).
 * Jurnalul e `record_obligation_audit`, ramura `obligation_completions`: doar la
 * inserare și ștergere, cu titlul obligației.
 */

import { desc, eq } from "drizzle-orm";

import { NEAUTENTIFICAT, canWriteCompletions, type Actor } from "@/lib/acl";
import { auditContext, auditInsert, completionAudit } from "@/lib/audit";
import { isUniqueViolation, type Db } from "@/lib/db";
import { obligationCompletions, obligations } from "@/lib/db/schema";
import { runBatch } from "./common";

type Result = { error?: string; success?: boolean; removed?: string };

async function titleOf(db: Db, obligationId: string): Promise<string | null> {
  const row = await db
    .select({ title: obligations.title })
    .from(obligations)
    .where(eq(obligations.id, obligationId))
    .get();
  return row?.title ?? null;
}

/**
 * Bifează un termen anume, nu „obligația".
 *
 * `due_date` vine din calcul, nu din ceasul apăsării: altfel o bifă pusă pe 2
 * septembrie n-ar spune dacă acoperă termenul din august sau pe cel din
 * septembrie — adică exact întrebarea la care evidența trebuie să răspundă.
 */
export async function markObligationDone(
  db: Db,
  me: Actor | null,
  obligationId: string,
  dueDate: string,
): Promise<Result> {
  if (!obligationId || !dueDate) return { error: "Lipsește obligația sau termenul." };
  if (!me) return { error: NEAUTENTIFICAT };
  if (!canWriteCompletions(me)) return { error: "Fără permisiune." };

  const ctx = auditContext(me);
  const row = {
    id: crypto.randomUUID(),
    obligation_id: obligationId,
    due_date: dueDate,
    completed_at: ctx.at,
    completed_by: me.id,
    note: null,
  };
  try {
    await runBatch(db, [
      db.insert(obligationCompletions).values(row),
      auditInsert(db, ctx, [completionAudit("INSERT", row, await titleOf(db, obligationId))]),
    ]);
  } catch (e) {
    // Doi oameni au bifat același termen în același moment.
    if (isUniqueViolation(e)) return { error: "Termenul e deja bifat." };
    return { error: e instanceof Error ? e.message : "Eroare la bifare." };
  }
  return { success: true };
}

/**
 * Scoate ultima bifă pusă — cea cu termenul cel mai mare din evidență.
 *
 * Ținta o alege serverul, dintr-o interogare, nu clientul, dintr-un calcul:
 * varianta veche recalcula pe ceasul clientului „cel mai recent termen trecut",
 * care după o bifă pusă din timp NU e bifa pusă acum. Anularea ștergea atunci
 * înregistrarea reală a lunii trecute și o lăsa pe cea greșită — registrul
 * mințea în ambele direcții, iar utilizatorului i se spunea că totul a mers.
 *
 * Data ștearsă se întoarce la client, ca mesajul să spună exact ce s-a scos.
 */
export async function undoObligationDone(db: Db, me: Actor | null, obligationId: string): Promise<Result> {
  if (!obligationId) return { error: "Lipsește obligația." };
  if (!me) return { error: NEAUTENTIFICAT };
  if (!canWriteCompletions(me)) return { error: "Fără permisiune." };

  const latest = await db
    .select()
    .from(obligationCompletions)
    .where(eq(obligationCompletions.obligation_id, obligationId))
    .orderBy(desc(obligationCompletions.due_date))
    .limit(1)
    .get();
  if (!latest) return { error: "Nu există nicio bifă de scos." };

  const title = await titleOf(db, obligationId);
  const deleted = await db.batch([
    db.delete(obligationCompletions).where(eq(obligationCompletions.id, latest.id)).returning(),
    auditInsert(db, auditContext(me), [completionAudit("DELETE", latest, title)]),
  ]);
  // Doi oameni au apăsat anularea în același moment: al doilea nu mai are ce
  // șterge, iar un „succes" aici ar ascunde că bifa dispăruse deja.
  if (deleted[0].length === 0) return { error: "Bifa nu mai există." };
  return { success: true, removed: latest.due_date };
}
