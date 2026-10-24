"use server";

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/notifications";
import type { Notification } from "@/lib/types";

function refresh() {
  // Clopoțelul e în antetul comun, prezent pe paginile de modul.
  revalidatePath("/");
  revalidatePath("/sarcini");
  revalidatePath("/petitii");
}

export async function markNotificationRead(id: string): Promise<{ error?: string }> {
  const res = await data.markRead(getDb(), await getActor(), id);
  if (!res.error) refresh();
  return res;
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const res = await data.markAllRead(getDb(), await getActor());
  if (!res.error) refresh();
  return res;
}

/** Verificarea periodică a clopoțelului. Nu reîmprospătează nicio pagină: doar citește. */
export async function pollNotifications(
  since: string | null,
): Promise<{ fresh: Notification[]; unread: number } | { error: string }> {
  return data.pollNotifications(getDb(), await getActor(), since);
}
