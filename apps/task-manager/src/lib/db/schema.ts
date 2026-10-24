/**
 * Schema bazei D1, oglinda tabelelor din `supabase/migrations`.
 *
 * Coloanele au **aceleași nume și aceleași valori** ca în Postgres, ca rândurile
 * să ajungă în componente cu forma din `lib/types.ts`, neschimbată:
 *
 * - `uuid` → text; id-ul nou îl face aplicația (`crypto.randomUUID()`), nu baza;
 * - `timestamptz` → text ISO în UTC, cu milisecunde (`2026-10-24T05:12:33.123Z`),
 *   exact ce dă `Date.toISOString()`. Un singur format, ca ordonarea ca text să
 *   fie și ordonare în timp; importul aduce valorile vechi la el;
 * - `date` → text AAAA-LL-ZZ, ca până acum;
 * - `jsonb` → text JSON, citit înapoi ca obiect de Drizzle;
 * - `boolean` → 0/1, citit înapoi ca `true`/`false`.
 *
 * Regulile din Postgres rămân reguli ale bazei acolo unde SQLite le poate ține:
 * `check`, chei străine cu `cascade`/`set null`, unicitate, coloane generate.
 * Ce făceau triggerele (audit, `updated_at`, `completed_at`, gărzile de rol și
 * responsabil) trece în aplicație — vezi `lib/audit.ts`.
 *
 * Tabelele `stat_*` lipsesc dinadins: statisticile au plecat în aplicația lor,
 * iar datele vechi rămân în Supabase și în ultima copie.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Clipa de acum, în formatul `toISOString()`. */
const NOW = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => text("created_at").notNull().default(NOW);
const updatedAt = () => text("updated_at").notNull().default(NOW);
const bool = (name: string) => integer(name, { mode: "boolean" });

/** Penitenciarele partenere: 1–18, fără 6 (al nostru) și 14 (nu există). */
const institutionCheck = (table: string) =>
  check(`${table}_institution_check`, sql`institution between 1 and 18 and institution not in (6, 14)`);

/* ------------------------------------------------------------- logarea */

/**
 * Conturile. Înlocuiesc `auth.users` din Supabase: aceleași id-uri, aceleași
 * adrese `@intern.local` și aceleași amprente bcrypt, deci parolele vechi merg.
 */
export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Sesiunile deschise. Cookie-ul poartă jetonul; aici stă doar amprenta lui
 * SHA-256, deci o copie a bazei nu deschide nicio sesiune.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------- oamenii */

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    full_name: text("full_name"),
    avatar_url: text("avatar_url"),
    role: text("role", { enum: ["admin", "member"] }).default("member"),
    created_at: text("created_at").default(NOW),
    username: text("username"),
  },
  (t) => [
    check("profiles_role_check", sql`role in ('admin', 'member')`),
    uniqueIndex("profiles_username_lower_idx")
      .on(sql`lower(username)`)
      .where(sql`username is not null`),
  ],
);

/* ------------------------------------------------------------- sarcinile */

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: ["todo", "in_progress", "waiting", "done"] })
      .notNull()
      .default("todo"),
    priority: text("priority", { enum: ["low", "medium", "high"] })
      .notNull()
      .default("medium"),
    due_date: text("due_date"),
    assignee_id: text("assignee_id").references(() => profiles.id, { onDelete: "set null" }),
    created_by: text("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    created_at: text("created_at").default(NOW),
    updated_at: text("updated_at").default(NOW),
    waiting_since: text("waiting_since"),
    completed_at: text("completed_at"),
    appealed_csj: bool("appealed_csj").notNull().default(false),
  },
  (t) => [
    check("tasks_status_check", sql`status in ('todo', 'in_progress', 'waiting', 'done')`),
    check("tasks_priority_check", sql`priority in ('low', 'medium', 'high')`),
    index("tasks_assignee_idx").on(t.assignee_id),
  ],
);

export const tags = sqliteTable("tags", {
  id: id(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#64748b"),
});

export const taskTags = sqliteTable(
  "task_tags",
  {
    task_id: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tag_id: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.task_id, t.tag_id] }), index("task_tags_tag_idx").on(t.tag_id)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: id(),
    task_id: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    author_id: text("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    created_at: text("created_at").default(NOW),
  },
  (t) => [index("comments_task_idx").on(t.task_id)],
);

export const subtasks = sqliteTable(
  "subtasks",
  {
    id: id(),
    task_id: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: bool("done").notNull().default(false),
    position: integer("position").notNull().default(0),
    done_at: text("done_at"),
    created_at: createdAt(),
  },
  (t) => [index("subtasks_task_idx").on(t.task_id, t.position)],
);

/* ------------------------------------------------------------- petițiile */

export const petitions = sqliteTable(
  "petitions",
  {
    id: id(),
    number: text("number").notNull().unique(),
    petitioner: text("petitioner").notNull(),
    petitioner_type: text("petitioner_type", { enum: ["detinut", "avocat", "civil"] })
      .notNull()
      .default("detinut"),
    subject: text("subject"),
    received_date: text("received_date").notNull().default(sql`(date('now'))`),
    // Data înregistrării + 27 de zile, ca în 0012 (a 27-a zi e ultima).
    response_deadline: text("response_deadline").generatedAlwaysAs(
      sql`date(received_date, '+27 days')`,
      { mode: "stored" },
    ),
    status: text("status", { enum: ["in_examinare", "solutionat"] })
      .notNull()
      .default("in_examinare"),
    response: text("response"),
    response_date: text("response_date"),
    assignee_id: text("assignee_id").references(() => profiles.id, { onDelete: "set null" }),
    created_by: text("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    created_at: text("created_at").default(NOW),
    updated_at: text("updated_at").default(NOW),
  },
  (t) => [
    check("petitions_petitioner_type_check", sql`petitioner_type in ('detinut', 'avocat', 'civil')`),
    check("petitions_status_check", sql`status in ('in_examinare', 'solutionat')`),
    index("petitions_deadline_idx").on(t.response_deadline),
  ],
);

export const petitionAttachments = sqliteTable(
  "petition_attachments",
  {
    id: id(),
    petition_id: text("petition_id")
      .notNull()
      .references(() => petitions.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["petitie", "raspuns"] }).notNull(),
    path: text("path").notNull().unique(),
    name: text("name").notNull(),
    mime: text("mime"),
    size: integer("size"),
    uploaded_by: text("uploaded_by").references(() => profiles.id, { onDelete: "set null" }),
    created_at: createdAt(),
  },
  (t) => [
    check("petition_attachments_kind_check", sql`kind in ('petitie', 'raspuns')`),
    index("petition_attachments_petition_idx").on(t.petition_id),
  ],
);

/* ------------------------------------------------------------- registrele */

export const hearings = sqliteTable(
  "hearings",
  {
    id: id(),
    session_date: text("session_date").notNull().unique(),
    tc_petrecute: integer("tc_petrecute").notNull().default(0),
    tc_amanate: integer("tc_amanate").notNull().default(0),
    ij_petrecute: integer("ij_petrecute").notNull().default(0),
    ij_amanate: integer("ij_amanate").notNull().default(0),
    tc_total: integer("tc_total").generatedAlwaysAs(sql`tc_petrecute + tc_amanate`, {
      mode: "stored",
    }),
    ij_total: integer("ij_total").generatedAlwaysAs(sql`ij_petrecute + ij_amanate`, {
      mode: "stored",
    }),
    total_general: integer("total_general").generatedAlwaysAs(
      sql`tc_petrecute + tc_amanate + ij_petrecute + ij_amanate`,
      { mode: "stored" },
    ),
    note: text("note"),
    created_by: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    updated_by: text("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  () => [
    check(
      "hearings_counts_check",
      sql`tc_petrecute >= 0 and tc_amanate >= 0 and ij_petrecute >= 0 and ij_amanate >= 0`,
    ),
  ],
);

export const transfers = sqliteTable(
  "transfers",
  {
    id: id(),
    transfer_date: text("transfer_date").notNull(),
    institution: integer("institution").notNull(),
    kind: text("kind", { enum: ["planificat", "urgent"] }).notNull().default("planificat"),
    plecati: integer("plecati").notNull().default(0),
    sositi: integer("sositi").notNull().default(0),
    total: integer("total").generatedAlwaysAs(sql`plecati + sositi`, { mode: "stored" }),
    note: text("note"),
    created_by: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    updated_by: text("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    institutionCheck("transfers"),
    check("transfers_kind_check", sql`kind in ('planificat', 'urgent')`),
    check("transfers_counts_check", sql`plecati >= 0 and sositi >= 0`),
    uniqueIndex("transfers_day_unique").on(t.transfer_date, t.institution, t.kind),
    index("transfers_date_idx").on(t.transfer_date),
  ],
);

export const transferPlans = sqliteTable(
  "transfer_plans",
  {
    id: id(),
    last_name: text("last_name").notNull(),
    first_name: text("first_name").notNull(),
    court: text("court"),
    institution: integer("institution").notNull(),
    hearing_date: text("hearing_date"),
    done: bool("done").notNull().default(false),
    note: text("note"),
    created_by: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    updated_by: text("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    created_at: createdAt(),
    updated_at: updatedAt(),
    basis: text("basis", { enum: ["sedinta", "decizie", "termen30"] })
      .notNull()
      .default("sedinta"),
    decision_date: text("decision_date"),
    notified_at: text("notified_at"),
    notified_by: text("notified_by").references(() => profiles.id, { onDelete: "set null" }),
    notified_hearing_date: text("notified_hearing_date"),
    ruling_date: text("ruling_date"),
    term_start: text("term_start"),
  },
  (t) => [
    check("transfer_plans_last_name_check", sql`length(trim(last_name)) > 0`),
    check("transfer_plans_first_name_check", sql`length(trim(first_name)) > 0`),
    check("transfer_plans_court_check", sql`court is null or length(trim(court)) > 0`),
    institutionCheck("transfer_plans"),
    check("transfer_plans_basis_check", sql`basis in ('sedinta', 'decizie', 'termen30')`),
    check(
      "transfer_plans_temei",
      sql`(basis = 'sedinta' and hearing_date is not null and decision_date is null and ruling_date is null and court is not null)
        or (basis = 'decizie' and decision_date is not null and hearing_date is null and ruling_date is null)
        or (basis = 'termen30' and ruling_date is not null and term_start is not null and hearing_date is null and decision_date is null and court is not null)`,
    ),
    check(
      "transfer_plans_instiintare",
      sql`(notified_at is null and notified_hearing_date is null) or (notified_at is not null and notified_hearing_date is not null)`,
    ),
    check(
      "transfer_plans_ruling_before_start",
      sql`ruling_date is null or term_start is null or ruling_date <= term_start`,
    ),
    index("transfer_plans_hearing_idx").on(t.hearing_date).where(sql`done = 0`),
    index("transfer_plans_decision_idx").on(t.decision_date).where(sql`done = 0`),
  ],
);

export const obligations = sqliteTable(
  "obligations",
  {
    id: id(),
    title: text("title").notNull(),
    recipient: text("recipient").notNull().default("ANP"),
    kind: text("kind", { enum: ["lunar_zi", "lunar_ultima_zi", "saptamanal"] }).notNull(),
    day_of_month: integer("day_of_month"),
    weekday: integer("weekday"),
    assignee_id: text("assignee_id").references(() => profiles.id, { onDelete: "set null" }),
    active: bool("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    note: text("note"),
    created_at: createdAt(),
    updated_at: updatedAt(),
    starts_on: text("starts_on").notNull().default(sql`(date('now'))`),
  },
  () => [
    check("obligations_title_check", sql`length(trim(title)) > 0`),
    check("obligations_kind_check", sql`kind in ('lunar_zi', 'lunar_ultima_zi', 'saptamanal')`),
    check("obligations_day_check", sql`day_of_month is null or day_of_month between 1 and 31`),
    check("obligations_weekday_check", sql`weekday is null or weekday between 0 and 6`),
    check(
      "obligations_kind_fields",
      sql`(kind = 'lunar_zi' and day_of_month is not null and weekday is null)
        or (kind = 'lunar_ultima_zi' and day_of_month is null and weekday is null)
        or (kind = 'saptamanal' and weekday is not null and day_of_month is null)`,
    ),
  ],
);

export const obligationCompletions = sqliteTable(
  "obligation_completions",
  {
    id: id(),
    obligation_id: text("obligation_id")
      .notNull()
      .references(() => obligations.id, { onDelete: "cascade" }),
    due_date: text("due_date").notNull(),
    completed_at: text("completed_at").notNull().default(NOW),
    completed_by: text("completed_by").references(() => profiles.id, { onDelete: "set null" }),
    note: text("note"),
  },
  (t) => [uniqueIndex("obligation_completions_unique").on(t.obligation_id, t.due_date)],
);

export const defendants = sqliteTable(
  "defendants",
  {
    id: id(),
    last_name: text("last_name").notNull(),
    first_name: text("first_name").notNull(),
    regime: text("regime", { enum: ["inchis", "semiinchis"] }).notNull(),
    established_on: text("established_on").notNull(),
    court: text("court"),
    case_number: text("case_number"),
    status: text("status", { enum: ["inculpat", "condamnat"] }).notNull().default("inculpat"),
    convicted_on: text("convicted_on"),
    note: text("note"),
    created_by: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    updated_by: text("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    created_at: createdAt(),
    updated_at: updatedAt(),
    preventive_measure: bool("preventive_measure").notNull().default(false),
    preventive_measure_on: text("preventive_measure_on"),
  },
  (t) => [
    check("defendants_last_name_check", sql`length(trim(last_name)) > 0`),
    check("defendants_first_name_check", sql`length(trim(first_name)) > 0`),
    check("defendants_regime_check", sql`regime in ('inchis', 'semiinchis')`),
    check("defendants_status_check", sql`status in ('inculpat', 'condamnat')`),
    check(
      "defendants_status_date",
      sql`(status = 'inculpat' and convicted_on is null) or (status = 'condamnat' and convicted_on is not null)`,
    ),
    check("defendants_preventive", sql`preventive_measure or preventive_measure_on is null`),
    index("defendants_status_idx").on(t.status, t.last_name),
  ],
);

export const contraveners = sqliteTable(
  "contraveners",
  {
    id: id(),
    last_name: text("last_name").notNull(),
    first_name: text("first_name").notNull(),
    patronymic: text("patronymic"),
    decision_date: text("decision_date").notNull(),
    final_date: text("final_date"),
    arrest_days: integer("arrest_days").notNull(),
    created_by: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    updated_by: text("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    created_at: createdAt(),
    updated_at: updatedAt(),
    executed_on: text("executed_on"),
    informed_at: text("informed_at"),
    informed_by: text("informed_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (t) => [
    check("contraveners_last_name_check", sql`length(trim(last_name)) > 0`),
    check("contraveners_first_name_check", sql`length(trim(first_name)) > 0`),
    check("contraveners_arrest_days_check", sql`arrest_days > 0`),
    check(
      "contraveners_final_after_decision",
      sql`final_date is null or final_date >= decision_date`,
    ),
    check(
      "contraveners_executed_after_decision",
      sql`executed_on is null or executed_on >= decision_date`,
    ),
    index("contraveners_decision_idx").on(t.decision_date),
  ],
);

export const releases = sqliteTable(
  "releases",
  {
    id: id(),
    release_date: text("release_date").notNull().unique(),
    count: integer("count").notNull().default(0),
    note: text("note"),
    created_by: text("created_by").references(() => profiles.id, { onDelete: "set null" }),
    updated_by: text("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  () => [check("releases_count_check", sql`count >= 0`)],
);

/* ------------------------------------------------------------- evidența */

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["assigned", "comment", "status", "edited", "deleted", "created"],
    }).notNull(),
    task_id: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    actor_id: text("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    actor_name: text("actor_name"),
    message: text("message").notNull(),
    read: bool("read").notNull().default(false),
    created_at: createdAt(),
    petition_id: text("petition_id").references(() => petitions.id, { onDelete: "set null" }),
  },
  (t) => [
    check(
      "notifications_type_check",
      sql`type in ('assigned', 'comment', 'status', 'edited', 'deleted', 'created')`,
    ),
    index("notifications_user_unread_idx").on(t.user_id, t.read, t.created_at),
    index("notifications_petition_idx").on(t.petition_id),
  ],
);

/**
 * Jurnalul de audit. Fără chei străine, ca în Postgres: un rând rămâne și după
 * ce omul sau lucrul despre care vorbește a fost șters — de asta există.
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    actor_id: text("actor_id"),
    actor_name: text("actor_name"),
    action: text("action", { enum: ["INSERT", "UPDATE", "DELETE"] }).notNull(),
    entity: text("entity").notNull(),
    entity_id: text("entity_id"),
    details: text("details", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    created_at: createdAt(),
  },
  (t) => [
    index("audit_log_created_at_idx").on(t.created_at),
    index("audit_log_entity_idx").on(t.entity, t.entity_id),
  ],
);

export const backupRuns = sqliteTable(
  "backup_runs",
  {
    id: id(),
    started_at: text("started_at").notNull().default(NOW),
    finished_at: text("finished_at"),
    ok: bool("ok").notNull().default(false),
    tables_count: integer("tables_count").notNull().default(0),
    rows_count: integer("rows_count").notNull().default(0),
    files_uploaded: integer("files_uploaded").notNull().default(0),
    files_pending: integer("files_pending").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("backup_runs_started_idx").on(t.started_at)],
);

