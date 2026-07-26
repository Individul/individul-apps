"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}
