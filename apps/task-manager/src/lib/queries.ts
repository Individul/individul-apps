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
  PetitionAttachment,
} from "./types";

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

export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
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

  // Încercăm cu numărul de atașamente; dacă migrarea 0013 nu e aplicată,
  // relația nu există și reluăm fără ea (lista trebuie să funcționeze oricum).
  const withCounts = await supabase
    .from("petitions")
    .select(`${base}, petition_attachments(id)`)
    .order("response_deadline", { ascending: true });

  let rows = withCounts.data;
  if (withCounts.error) {
    const plain = await supabase
      .from("petitions")
      .select(base)
      .order("response_deadline", { ascending: true });
    // Grațios dacă migrarea 0012 nu e încă aplicată.
    if (plain.error) return [];
    rows = plain.data;
  }

  return (
    (rows ?? []) as unknown as (Petition & { petition_attachments?: { id: string }[] })[]
  ).map(({ petition_attachments: atts, ...p }) => ({
    ...p,
    attachments_count: atts?.length ?? 0,
  }));
}

export async function getPetitionAttachments(petitionId: string): Promise<PetitionAttachment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("petition_attachments")
    .select("*")
    .eq("petition_id", petitionId)
    .order("created_at", { ascending: true });
  // Grațios dacă migrarea 0013 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as PetitionAttachment[];
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
