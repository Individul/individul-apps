/**
 * Citirile paginilor, din D1.
 *
 * Funcțiile păstrează numele și forma rezultatelor de pe vremea Supabase, ca
 * paginile și componentele să nu afle de schimbare. Trei lucruri pe care le
 * făcea baza și pe care acum le face codul de aici:
 *
 * - **dreptul de citire.** Aproape totul e „orice om conectat citește", iar
 *   paginile nu se deschid fără sesiune (middleware). Excepțiile — jurnalul și
 *   copiile, doar pentru admin; notificările, doar ale tale — filtrează aici,
 *   explicit: o interogare fără filtru nu mai e oprită de nimeni;
 * - **relațiile încorporate** (`assignee:profiles(*)`, `tags(*)`…) se adună din
 *   câteva interogări trimise deodată, într-un `batch`;
 * - **ordinea textelor.** Postgres ordona după colaționarea ICU `en-US`, iar
 *   SQLite compară octeți („Ș" ar ajunge după „Z"). Ordonarea pe nume se face
 *   deci în JavaScript, cu același ICU. Valorile nule merg la coadă, ca în
 *   Postgres la ordinea crescătoare.
 */

import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getActor, getCurrentUserId as currentUserId } from "@/lib/auth/server";
import { canReadAuditLog, canReadBackupRuns } from "@/lib/acl";
import {
  COLOANE_PETITIE,
  COLOANE_SARCINA,
  type PetitieRaport,
  type SarcinaRaport,
} from "@/lib/raport-activitate";
import type {
  Task,
  Profile,
  Tag,
  Comment,
  AuditEntry,
  Notification,
  Subtask,
  Petition,
  Transfer,
  Release,
} from "./types";
import type { Hearing } from "./hearings";
import type { TransferPlan } from "./transfer-plans";
import type { BackupRun } from "./backup";
import type { Obligation } from "./obligations";
import type { Defendant } from "./defendants";
import type { Contravener } from "./contraveners";

/* ------------------------------------------------------------ ordinea */

const ICU = new Intl.Collator("en-US");

/** `order by <col>` din Postgres: ICU `en-US`, nulele la coadă. */
export function byText<T>(get: (row: T) => string | null | undefined) {
  return (a: T, b: T) => {
    const x = get(a);
    const y = get(b);
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    return ICU.compare(x, y);
  };
}

/** Rândurile din D1 au tipul din schemă; paginile vechi așteaptă tipurile lor. */
const as = <T>(rows: unknown) => rows as T;

/* ------------------------------------------------------------ oamenii */

export const getCurrentUserId = currentUserId;

/**
 * Profilul celui conectat.
 *
 * Învelit în `cache` din React: antetul stă în layout, iar unele pagini au și
 * ele nevoie de profil ca să știe dacă e admin. Fără învelișul acesta, aceeași
 * randare ar cere de două ori același lucru. `cache` ține răspunsul cât ține o
 * singură randare; între cereri nu păstrează nimic, deci nimeni nu poate primi
 * profilul altuia.
 */
export const getCurrentProfile = cache(async function getCurrentProfile(): Promise<Profile | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const row = await getDb().select().from(s.profiles).where(eq(s.profiles.id, uid)).get();
  return as<Profile | null>(row ?? null);
});

export async function getProfiles(): Promise<Profile[]> {
  const rows = await getDb().select().from(s.profiles);
  return as<Profile[]>(rows.sort(byText((p) => p.full_name)));
}

export async function getTags(): Promise<Tag[]> {
  const rows = await getDb().select().from(s.tags);
  return rows.sort(byText((t) => t.name));
}

/* ------------------------------------------------------------ sarcinile */

/** Etichetele fiecărei sarcini, în ordinea în care au fost puse. */
async function tagsByTask(taskIds?: string[]): Promise<Map<string, Tag[]>> {
  const db = getDb();
  const rows = await db
    .select({ task_id: s.taskTags.task_id, id: s.tags.id, name: s.tags.name, color: s.tags.color })
    .from(s.taskTags)
    .innerJoin(s.tags, eq(s.tags.id, s.taskTags.tag_id))
    .where(taskIds ? inArray(s.taskTags.task_id, taskIds) : undefined)
    .orderBy(sql`${s.taskTags}.rowid`);
  const map = new Map<string, Tag[]>();
  for (const { task_id, ...tag } of rows) {
    const list = map.get(task_id) ?? [];
    list.push(tag);
    map.set(task_id, list);
  }
  return map;
}

export async function getTasks(): Promise<Task[]> {
  const db = getDb();
  const [rows, people] = await db.batch([
    db.select().from(s.tasks).orderBy(desc(s.tasks.created_at)),
    db.select().from(s.profiles),
  ]);
  const tags = await tagsByTask();
  const byId = new Map(people.map((p) => [p.id, p]));
  return as<Task[]>(
    rows.map((t) => ({
      ...t,
      assignee: t.assignee_id ? (byId.get(t.assignee_id) ?? null) : null,
      tags: tags.get(t.id) ?? [],
    })),
  );
}

/**
 * Coloanele din care pagina de start scoate cifrele sarcinilor: statisticile
 * cardului (`taskStats`) plus defalcarea pe responsabil (`groupByAssignee`).
 *
 * O singură listă, din care ies și tipul, și coloanele cerute bazei. Scrise
 * separat, cele două ar fi putut ajunge să spună lucruri diferite: un câmp pe
 * care codul îl citește, interogarea nu-l aduce, iar el sosește `undefined` la
 * fiecare rulare, tăcut. Derivate dintr-o listă, nu se mai pot contrazice.
 */
const TASK_COUNT_COLUMNS = ["status", "due_date", "assignee_id"] as const;
export type TaskCountRow = Pick<Task, (typeof TASK_COUNT_COLUMNS)[number]>;

/**
 * Sarcinile reduse la ce se numără pe pagina de start. Nu înlocuiește
 * `getTasks`: /sarcini afișează rândurile întregi, cu responsabil și etichete.
 * Aceeași ordonare ca `getTasks`: gruparea pe responsabil păstrează ordinea de
 * intrare la egalitate, deci tabelul iese la fel.
 */
export async function getTaskCounts(): Promise<TaskCountRow[]> {
  const rows = await getDb()
    .select({ status: s.tasks.status, due_date: s.tasks.due_date, assignee_id: s.tasks.assignee_id })
    .from(s.tasks)
    .orderBy(desc(s.tasks.created_at));
  return rows;
}

export async function getTask(id: string): Promise<(Task & { comments: Comment[] }) | null> {
  const db = getDb();
  const [task, comments, people] = await db.batch([
    db.select().from(s.tasks).where(eq(s.tasks.id, id)),
    db.select().from(s.comments).where(eq(s.comments.task_id, id)),
    db.select().from(s.profiles),
  ]);
  if (!task[0]) return null;
  const byId = new Map(people.map((p) => [p.id, p]));
  const tags = await tagsByTask([id]);
  const t = task[0];
  return as<Task & { comments: Comment[] }>({
    ...t,
    assignee: t.assignee_id ? (byId.get(t.assignee_id) ?? null) : null,
    tags: tags.get(id) ?? [],
    // ordonează comentariile cronologic
    comments: comments
      .map((c) => ({ ...c, author: byId.get(c.author_id) }))
      .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()),
  });
}

/**
 * Istoricul sarcinii: rândurile ei din jurnal plus ale pașilor ei — ce făcea
 * `task_history` (0011). La aceeași clipă, ordinea scrierii (`rowid`).
 */
export async function getTaskHistory(taskId: string): Promise<AuditEntry[]> {
  const rows = await getDb()
    .select()
    .from(s.auditLog)
    .where(
      or(
        and(eq(s.auditLog.entity, "tasks"), eq(s.auditLog.entity_id, taskId)),
        and(
          eq(s.auditLog.entity, "subtasks"),
          sql`json_extract(${s.auditLog.details}, '$.task_id') = ${taskId}`,
        ),
      ),
    )
    .orderBy(asc(s.auditLog.created_at), sql`${s.auditLog}.rowid`);
  return as<AuditEntry[]>(rows);
}

export async function getSubtasks(taskId: string): Promise<Subtask[]> {
  return getDb()
    .select()
    .from(s.subtasks)
    .where(eq(s.subtasks.task_id, taskId))
    .orderBy(asc(s.subtasks.position), sql`${s.subtasks}.rowid`);
}

/**
 * Jurnalul, doar pentru admin — ca regula „audit select admin". Altcuiva îi
 * întoarce o listă goală, cum îi întorcea și Postgres.
 */
export async function getAuditLog(
  limit = 100,
  /** Entitățile cerute; listă goală înseamnă tot jurnalul. */
  entities: AuditEntry["entity"][] = [],
): Promise<AuditEntry[]> {
  const me = await getActor();
  if (!me || !canReadAuditLog(me)) return [];
  // Filtrul intră în interogare: altfel un modul puțin activ ar părea gol doar
  // pentru că ultimele N intrări aparțin altuia.
  const rows = await getDb()
    .select()
    .from(s.auditLog)
    .where(entities.length ? inArray(s.auditLog.entity, entities) : undefined)
    // La aceeași clipă (rândurile unei singure acțiuni), în ordinea scrierii —
    // cum le dădea și Postgres, măsurat pe jurnalul importat.
    .orderBy(desc(s.auditLog.created_at), sql`${s.auditLog}.rowid asc`)
    .limit(limit);
  return as<AuditEntry[]>(rows);
}

/* ------------------------------------------------------------ notificările */

/**
 * Ultimele înștiințări ale celui conectat. Filtrul pe `user_id` ține locul
 * regulii „notifications select own": fără el, fiecare le-ar vedea pe ale
 * tuturor.
 */
export const getNotifications = cache(async function getNotifications(
  limit = 20,
): Promise<Notification[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const rows = await getDb()
    .select()
    .from(s.notifications)
    .where(eq(s.notifications.user_id, uid))
    .orderBy(desc(s.notifications.created_at), sql`${s.notifications}.rowid asc`)
    .limit(limit);
  return as<Notification[]>(rows);
});

export const getUnreadCount = cache(async function getUnreadCount(): Promise<number> {
  const uid = await getCurrentUserId();
  if (!uid) return 0;
  const row = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(s.notifications)
    .where(and(eq(s.notifications.user_id, uid), eq(s.notifications.read, false)))
    .get();
  return row?.n ?? 0;
});

/* ------------------------------------------------------------ petițiile */

/**
 * Petițiile pentru listă.
 *
 * Fără profilul responsabilului încorporat în fiecare rând: pagina cere oricum
 * lista profilurilor separat, prin `getProfiles()`, deci lista își caută
 * responsabilul acolo. `assignee_id` rămâne, fiindcă după el se filtrează și se
 * face defalcarea.
 */
export async function getPetitions(): Promise<Petition[]> {
  const db = getDb();
  const [rows, files] = await db.batch([
    db.select().from(s.petitions).orderBy(asc(s.petitions.response_deadline)),
    db
      .select({
        petition_id: s.petitionAttachments.petition_id,
        id: s.petitionAttachments.id,
        path: s.petitionAttachments.path,
        name: s.petitionAttachments.name,
        kind: s.petitionAttachments.kind,
      })
      .from(s.petitionAttachments)
      .orderBy(sql`${s.petitionAttachments}.rowid`),
  ]);
  const byPetition = new Map<string, NonNullable<Petition["attachments"]>>();
  for (const { petition_id, ...f } of files) {
    const list = byPetition.get(petition_id) ?? [];
    list.push(f);
    byPetition.set(petition_id, list);
  }
  return as<Petition[]>(
    rows.map((p) => ({
      ...p,
      // Scanarea petiției înaintea răspunsului: e cea căutată din listă.
      attachments: [...(byPetition.get(p.id) ?? [])].sort((a, b) =>
        a.kind === b.kind ? 0 : a.kind === "petitie" ? -1 : 1,
      ),
    })),
  );
}

/**
 * Ce citesc `petitionStats` și defalcarea pe responsabil — nimic altceva.
 * O listă, două întrebuințări; vezi `TASK_COUNT_COLUMNS` pentru de ce.
 */
const PETITION_COUNT_COLUMNS = ["status", "response_deadline", "assignee_id"] as const;
export type PetitionCountRow = Pick<Petition, (typeof PETITION_COUNT_COLUMNS)[number]>;

/** Petițiile reduse la ce se numără pe pagina de start. */
export async function getPetitionCounts(): Promise<PetitionCountRow[]> {
  const rows = await getDb()
    .select({
      status: s.petitions.status,
      response_deadline: s.petitions.response_deadline,
      assignee_id: s.petitions.assignee_id,
    })
    .from(s.petitions)
    .orderBy(asc(s.petitions.response_deadline));
  return rows;
}

/* ------------------------------------------------------------ registrele */

export async function getHearings(from: string, to: string): Promise<Hearing[]> {
  const rows = await getDb()
    .select()
    .from(s.hearings)
    .where(and(gte(s.hearings.session_date, from), lte(s.hearings.session_date, to)))
    .orderBy(desc(s.hearings.session_date));
  return as<Hearing[]>(rows);
}

export async function getHearing(date: string): Promise<Hearing | null> {
  const row = await getDb().select().from(s.hearings).where(eq(s.hearings.session_date, date)).get();
  return as<Hearing | null>(row ?? null);
}

export interface ReleaseRegistry {
  rows: Release[];
  /** Fals doar dacă interogarea a eșuat; o săptămână fără eliberări e `[]` cu `true`. */
  available: boolean;
}

export async function getReleases(from: string, to: string): Promise<ReleaseRegistry> {
  try {
    const rows = await getDb()
      .select()
      .from(s.releases)
      .where(and(gte(s.releases.release_date, from), lte(s.releases.release_date, to)))
      .orderBy(desc(s.releases.release_date));
    return { rows: as<Release[]>(rows), available: true };
  } catch {
    return { rows: [], available: false };
  }
}

export async function getTransfers(): Promise<Transfer[]> {
  const rows = await getDb()
    .select()
    .from(s.transfers)
    .orderBy(desc(s.transfers.transfer_date), asc(s.transfers.institution));
  return as<Transfer[]>(rows);
}

const TRANSFER_COUNT_COLUMNS = ["transfer_date", "institution", "plecati", "sositi"] as const;
export type TransferCountRow = Pick<Transfer, (typeof TRANSFER_COUNT_COLUMNS)[number]>;

export async function getTransferCounts(): Promise<TransferCountRow[]> {
  return getDb()
    .select({
      transfer_date: s.transfers.transfer_date,
      institution: s.transfers.institution,
      plecati: s.transfers.plecati,
      sositi: s.transfers.sositi,
    })
    .from(s.transfers)
    .orderBy(desc(s.transfers.transfer_date), asc(s.transfers.institution));
}

/** Ultima rulare a copiei și ultima reușită — doar pentru admin, ca regula „backup_runs select". */
export async function getLastBackupRun(): Promise<{
  last: BackupRun | null;
  lastSuccess: BackupRun | null;
}> {
  const me = await getActor();
  if (!me || !canReadBackupRuns(me)) return { last: null, lastSuccess: null };
  const db = getDb();
  const columns = {
    started_at: s.backupRuns.started_at,
    finished_at: s.backupRuns.finished_at,
    ok: s.backupRuns.ok,
    files_uploaded: s.backupRuns.files_uploaded,
    files_pending: s.backupRuns.files_pending,
    error: s.backupRuns.error,
  };
  const [last, lastSuccess] = await db.batch([
    db.select(columns).from(s.backupRuns).orderBy(desc(s.backupRuns.started_at)).limit(1),
    db
      .select(columns)
      .from(s.backupRuns)
      .where(eq(s.backupRuns.ok, true))
      .orderBy(desc(s.backupRuns.started_at))
      .limit(1),
  ]);
  return { last: last[0] ?? null, lastSuccess: lastSuccess[0] ?? null };
}

/**
 * Planificarea transferurilor, după ziua ședinței. Cei fără ședință (temeiul
 * „decizie" sau „30 zile") vin la coadă, ca în Postgres — `nulls last`, scris,
 * fiindcă SQLite i-ar fi pus primii.
 */
export async function getTransferPlans(): Promise<TransferPlan[]> {
  const rows = await getDb()
    .select()
    .from(s.transferPlans)
    .orderBy(sql`${s.transferPlans.hearing_date} asc nulls last`);
  return as<TransferPlan[]>(rows);
}

export async function getObligations(): Promise<{
  obligations: Obligation[];
  completed: Map<string, Set<string>>;
}> {
  const db = getDb();
  const [rows, done] = await db.batch([
    db.select().from(s.obligations).where(eq(s.obligations.active, true)).orderBy(asc(s.obligations.position)),
    db
      .select({ obligation_id: s.obligationCompletions.obligation_id, due_date: s.obligationCompletions.due_date })
      .from(s.obligationCompletions),
  ]);

  const completed = new Map<string, Set<string>>();
  for (const row of done) {
    const set = completed.get(row.obligation_id) ?? new Set<string>();
    set.add(row.due_date);
    completed.set(row.obligation_id, set);
  }
  return { obligations: as<Obligation[]>(rows), completed };
}

export async function getDefendants(): Promise<Defendant[]> {
  const rows = await getDb().select().from(s.defendants);
  return as<Defendant[]>(rows.sort(byText((d) => d.last_name)));
}

/** Ordinea o dă `sortContraveners`, nu baza. */
export async function getContraveners(): Promise<Contravener[]> {
  return as<Contravener[]>(await getDb().select().from(s.contraveners));
}

/* ------------------------------------------------------------ rapoartele */

export async function getSarciniRaport(): Promise<SarcinaRaport[]> {
  const rows = await getDb().select().from(s.tasks);
  // Etichetele se cer pe lângă coloane: ele spun ce fel de lucrare a fost, iar
  // raportul le arată în dreptul fiecărei sarcini încheiate.
  const tags = await tagsByTask();
  return as<SarcinaRaport[]>(
    rows.map((t) => ({
      ...Object.fromEntries(COLOANE_SARCINA.map((c) => [c, t[c as keyof typeof t]])),
      tags: tags.get(t.id) ?? [],
    })),
  );
}

export async function getPetitiiRaport(): Promise<PetitieRaport[]> {
  const rows = await getDb().select().from(s.petitions);
  return as<PetitieRaport[]>(
    rows.map((p) => Object.fromEntries(COLOANE_PETITIE.map((c) => [c, p[c as keyof typeof p]]))),
  );
}
