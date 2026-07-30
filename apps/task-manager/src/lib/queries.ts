import { createClient } from "@/lib/supabase/server";
import type {
  Task,
  Profile,
  Tag,
  Comment,
  AuditEntry,
  Notification,
  Subtask,
  Petition,
  StatReport,
  StatValue,
  Transfer,
} from "./types";
import type { Hearing } from "./hearings";

export async function getTasks(): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assignee_id_fkey(*), tags(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Task[];
}

export async function getTask(id: string): Promise<(Task & { comments: Comment[] }) | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, assignee:profiles!tasks_assignee_id_fkey(*), tags(*), comments(*, author:profiles!comments_author_id_fkey(*))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // ordonează comentariile cronologic
  const task = data as unknown as Task & { comments: Comment[] };
  task.comments = (task.comments ?? []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return task;
}

export async function getTaskHistory(taskId: string): Promise<AuditEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("task_history", { p_task_id: taskId });
  // Grațios dacă migrarea 0009 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as AuditEntry[];
}

export async function getSubtasks(taskId: string): Promise<Subtask[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subtasks")
    .select("*")
    .eq("task_id", taskId)
    .order("position", { ascending: true });
  // Grațios dacă migrarea 0010 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as Subtask[];
}

export async function getProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("full_name");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function getTags(): Promise<Tag[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("tags").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function getAuditLog(
  limit = 100,
  /** Entitățile cerute; listă goală înseamnă tot jurnalul. */
  entities: AuditEntry["entity"][] = [],
): Promise<AuditEntry[]> {
  const supabase = createClient();
  // Filtrul intră în interogare: altfel un modul puțin activ ar părea gol doar
  // pentru că ultimele N intrări aparțin altuia.
  let query = supabase.from("audit_log").select("*");
  if (entities.length) query = query.in("entity", entities);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  // Tabela poate lipsi până se aplică migrarea 0007 — nu bloca pagina /admin.
  if (error) return [];
  return (data ?? []) as unknown as AuditEntry[];
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Profile | null;
}

export async function getNotifications(limit = 20): Promise<Notification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as Notification[];
}

export async function getPetitions(): Promise<Petition[]> {
  const supabase = createClient();
  const base = "*, assignee:profiles!petitions_assignee_id_fkey(*)";

  // Încercăm cu fișierele atașate; dacă migrarea 0013 nu e aplicată, relația
  // nu există și reluăm fără ea (lista trebuie să funcționeze oricum).
  const withFiles = await supabase
    .from("petitions")
    .select(`${base}, petition_attachments(id, path, name, kind)`)
    .order("response_deadline", { ascending: true });

  let rows = withFiles.data;
  if (withFiles.error) {
    const plain = await supabase
      .from("petitions")
      .select(base)
      .order("response_deadline", { ascending: true });
    // Grațios dacă migrarea 0012 nu e încă aplicată.
    if (plain.error) return [];
    rows = plain.data;
  }

  return (
    (rows ?? []) as unknown as (Petition & {
      petition_attachments?: NonNullable<Petition["attachments"]>;
    })[]
  ).map(({ petition_attachments: atts, ...p }) => ({
    ...p,
    // Scanarea petiției înaintea răspunsului: e cea căutată din listă.
    attachments: [...(atts ?? [])].sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === "petitie" ? -1 : 1,
    ),
  }));
}

/** Rândul brut cu relația încorporată; `stat_values` nu e o coloană. */
type StatReportRow = StatReport & { stat_values?: { id: string }[] };

/** Toate rapoartele, cele mai noi întâi, cu numărul de valori din fiecare. */
export async function getStatReports(): Promise<StatReport[]> {
  const supabase = createClient();

  // Încercăm cu valorile atașate; dacă migrarea 0016 nu e aplicată, relația nu
  // există și reluăm fără ea (pagina trebuie să funcționeze oricum).
  const withValues = await supabase
    .from("stat_reports")
    .select("*, stat_values(id)")
    .order("period_date", { ascending: false })
    .order("kind", { ascending: true });

  if (!withValues.error) {
    return ((withValues.data ?? []) as unknown as StatReportRow[]).map(
      ({ stat_values: values, ...report }) => ({ ...report, values_count: values?.length ?? 0 }),
    );
  }

  const plain = await supabase
    .from("stat_reports")
    .select("*")
    .order("period_date", { ascending: false })
    .order("kind", { ascending: true });
  // Grațios dacă nici tabela nu există încă.
  if (plain.error) return [];
  return ((plain.data ?? []) as unknown as StatReport[]).map((report) => ({
    ...report,
    values_count: 0,
  }));
}

/**
 * Rapoartele unui singur tip, cu valorile lor, în ordine cronologică — graficele
 * se citesc de la stânga la dreapta.
 */
export async function getStatValues(
  kind: string,
): Promise<{ report: StatReport; values: StatValue[] }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stat_reports")
    .select("*, stat_values(*)")
    .eq("kind", kind)
    .order("period_date", { ascending: true });
  // Grațios dacă migrarea 0016 nu e încă aplicată.
  if (error) return [];

  return ((data ?? []) as unknown as (StatReport & { stat_values?: StatValue[] })[]).map(
    ({ stat_values: values, ...report }) => {
      // `position` păstrează ordinea indicatorilor din fișierul-sursă.
      const sorted = [...(values ?? [])].sort((a, b) => a.position - b.position);
      return { report: { ...report, values_count: sorted.length }, values: sorted };
    },
  );
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) return 0;
  return count ?? 0;
}

export async function getHearings(from: string, to: string): Promise<Hearing[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hearings")
    .select("*")
    .gte("session_date", from)
    .lte("session_date", to)
    .order("session_date", { ascending: false });
  // Grațios dacă migrarea 0018 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as Hearing[];
}

export async function getHearing(date: string): Promise<Hearing | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hearings")
    .select("*")
    .eq("session_date", date)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as Hearing | null;
}

/**
 * Registrul întreg, zilele noi întâi, iar în aceeași zi penitenciarele în ordine
 * crescătoare — ordinea în care le caută cineva care citește ziua.
 *
 * Eroarea nu se citește: dacă migrarea 0020 nu e încă aplicată, `data` e null și
 * pagina se deschide goală în loc să crape.
 */
export async function getTransfers(): Promise<Transfer[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("transfers")
    .select("*")
    .order("transfer_date", { ascending: false })
    .order("institution", { ascending: true });
  return (data ?? []) as unknown as Transfer[];
}
