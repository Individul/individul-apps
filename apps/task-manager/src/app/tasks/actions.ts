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

export async function createTask(input: TaskInput): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Date invalide." };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { error } = await supabase
    .from("tasks")
    .insert({ ...normalize(parsed.data), created_by: userId });
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function updateTask(id: string, input: TaskInput): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Date invalide." };

  const supabase = createClient();
  const { error } = await supabase.from("tasks").update(normalize(parsed.data)).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return { success: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { success: true };
}
