import { createClient } from "@/lib/supabase/server";
import type { Task, Profile, Tag, Comment } from "./types";

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

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Profile | null;
}
