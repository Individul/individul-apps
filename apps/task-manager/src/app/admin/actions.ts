"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setUserRole(
  userId: string,
  role: "admin" | "member",
): Promise<{ error?: string; success?: boolean }> {
  if (role !== "admin" && role !== "member") return { error: "Rol invalid." };
  const supabase = createClient();

  // Nu-ți poți retrograda propriul rol (protecție și în cod, nu doar în UI).
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user?.id === userId && role === "member") {
    return { error: "Nu-ți poți retrograda propriul rol." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Fără permisiune sau utilizator inexistent." };
  revalidatePath("/admin");
  revalidatePath("/tasks");
  return { success: true };
}

type RestoreResult = {
  error?: string;
  inserted?: { tasks: number; tags: number; task_tags: number; comments: number };
};

// Restaurare non-distructivă: adaugă doar înregistrările lipsă (ON CONFLICT DO
// NOTHING), fără a șterge sau suprascrie ceva existent. Doar admin.
export async function restoreBackup(payload: unknown): Promise<RestoreResult> {
  const supabase = createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") return { error: "Doar adminul poate restaura." };

  const root = (payload as { data?: Record<string, unknown> } | null) ?? null;
  const d = root?.data ?? {};
  const tasks = Array.isArray(d.tasks) ? (d.tasks as Record<string, unknown>[]) : null;
  if (!tasks) return { error: "Fișier de backup invalid (lipsește data.tasks)." };
  const tags = Array.isArray(d.tags) ? (d.tags as Record<string, unknown>[]) : [];
  const taskTags = Array.isArray(d.task_tags) ? (d.task_tags as Record<string, unknown>[]) : [];
  const comments = Array.isArray(d.comments) ? (d.comments as Record<string, unknown>[]) : [];

  const inserted = { tasks: 0, tags: 0, task_tags: 0, comments: 0 };

  // Ordine pentru chei străine: tags -> tasks -> task_tags -> comments.
  if (tags.length) {
    const { data: r, error } = await supabase
      .from("tags")
      .upsert(tags, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: `Etichete: ${error.message}` };
    inserted.tags = r?.length ?? 0;
  }
  if (tasks.length) {
    const { data: r, error } = await supabase
      .from("tasks")
      .upsert(tasks, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: `Sarcini: ${error.message}` };
    inserted.tasks = r?.length ?? 0;
  }
  if (taskTags.length) {
    const { data: r, error } = await supabase
      .from("task_tags")
      .upsert(taskTags, { onConflict: "task_id,tag_id", ignoreDuplicates: true })
      .select("task_id");
    if (error) return { error: `Legături etichetă: ${error.message}` };
    inserted.task_tags = r?.length ?? 0;
  }
  if (comments.length) {
    const { data: r, error } = await supabase
      .from("comments")
      .upsert(comments, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) return { error: `Comentarii: ${error.message}` };
    inserted.comments = r?.length ?? 0;
  }

  revalidatePath("/tasks");
  revalidatePath("/admin");
  return { inserted };
}
