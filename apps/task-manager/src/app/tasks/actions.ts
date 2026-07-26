"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { taskSchema, type TaskInput } from "@/lib/schemas";

type ActionResult = { error?: string; success?: boolean };

function normalize(input: TaskInput) {
  return {
    title: input.title.trim(),
    description: input.description ? input.description : null,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date ? input.due_date : null,
    assignee_id: input.assignee_id ? input.assignee_id : null,
  };
}

export async function createTask(input: TaskInput, tagIds: string[] = []): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Date invalide." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data: newTask, error } = await supabase
    .from("tasks")
    .insert({ ...normalize(parsed.data), created_by: userId })
    .select("id")
    .single();
  if (error || !newTask) return { error: error?.message ?? "Eroare la crearea sarcinii." };

  if (tagIds.length) {
    const rows = tagIds.map((tag_id) => ({ task_id: newTask.id as string, tag_id }));
    const { error: tagErr } = await supabase.from("task_tags").insert(rows);
    if (tagErr) return { error: tagErr.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function updateTask(
  id: string,
  input: TaskInput,
  tagIds: string[] = [],
): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Date invalide." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(normalize(parsed.data))
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Sarcină inexistentă sau fără permisiune." };

  // Sincronizează etichetele (adaugă cele noi, elimină cele deselectate).
  const { data: existing } = await supabase.from("task_tags").select("tag_id").eq("task_id", id);
  const current = new Set((existing ?? []).map((r) => r.tag_id as string));
  const toAdd = tagIds.filter((t) => !current.has(t));
  const toRemove = [...current].filter((t) => !tagIds.includes(t));
  if (toAdd.length) {
    const { error: addErr } = await supabase
      .from("task_tags")
      .insert(toAdd.map((tag_id) => ({ task_id: id, tag_id })));
    if (addErr) return { error: addErr.message };
  }
  if (toRemove.length) {
    const { error: remErr } = await supabase
      .from("task_tags")
      .delete()
      .eq("task_id", id)
      .in("tag_id", toRemove);
    if (remErr) return { error: remErr.message };
  }

  revalidatePath("/");
  revalidatePath(`/tasks/${id}`);
  return { success: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.from("tasks").delete().eq("id", id).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Sarcină inexistentă sau fără permisiune." };

  revalidatePath("/");
  return { success: true };
}

// Marchează sarcina ca finalizată. Regula „proprie sau admin" e impusă de
// politica RLS `tasks update` (admin OR created_by OR assignee); dacă userul nu
// are drept, update-ul afectează 0 rânduri și întoarcem eroare.
export async function finalizeTask(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "done" })
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Sarcină inexistentă sau fără permisiune." };

  revalidatePath("/");
  revalidatePath(`/tasks/${id}`);
  return { success: true };
}

export async function createTag(name: string, color: string): Promise<{ error?: string; tag?: { id: string; name: string; color: string } }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Numele etichetei e obligatoriu." };
  const supabase = createClient();

  // Doar adminul poate crea etichete (impus și de RLS).
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") return { error: "Doar adminul poate crea etichete." };

  const { data, error } = await supabase
    .from("tags")
    .insert({ name: trimmed, color })
    .select()
    .single();
  if (error) return { error: error.message };
  return { tag: data as { id: string; name: string; color: string } };
}

export async function attachTag(taskId: string, tagId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();
  const { error } = await supabase.from("task_tags").insert({ task_id: taskId, tag_id: tagId });
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/");
  return { success: true };
}

export async function detachTag(taskId: string, tagId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("task_tags")
    .delete()
    .eq("task_id", taskId)
    .eq("tag_id", tagId);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/");
  return { success: true };
}

export async function addComment(taskId: string, body: string): Promise<{ error?: string; success?: boolean }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Comentariul nu poate fi gol." };
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { error } = await supabase
    .from("comments")
    .insert({ task_id: taskId, author_id: userId, body: trimmed });
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function editComment(commentId: string, taskId: string, body: string): Promise<{ error?: string; success?: boolean }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Comentariul nu poate fi gol." };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ body: trimmed })
    .eq("id", commentId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Comentariu inexistent sau fără permisiune." };
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function deleteComment(commentId: string, taskId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Comentariu inexistent sau fără permisiune." };
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}
