"use server";

/**
 * Acțiunile sarcinilor: legătura dintre cerere și `lib/data/tasks.ts`.
 *
 * Aici stau doar cine e conectat și ce pagini se reîmprospătează. Dreptul,
 * jurnalul și notificările sunt ale modulului de date, unde se testează.
 */

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/tasks";
import type { TaskInput } from "@/lib/schemas";

type ActionResult = { error?: string; success?: boolean };

function refreshLists() {
  revalidatePath("/sarcini");
  revalidatePath("/");
}

export async function createTask(input: TaskInput, tagIds: string[] = []): Promise<ActionResult> {
  const res = await data.createTask(getDb(), await getActor(), input, tagIds);
  if (res.success) refreshLists();
  return res;
}

export async function updateTask(id: string, input: TaskInput, tagIds: string[] = []): Promise<ActionResult> {
  const res = await data.updateTask(getDb(), await getActor(), id, input, tagIds);
  if (res.success) {
    refreshLists();
    revalidatePath(`/tasks/${id}`);
  }
  return res;
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const res = await data.deleteTask(getDb(), await getActor(), id);
  if (res.success) refreshLists();
  return res;
}

export async function setTaskAppealedCsj(id: string, appealed: boolean): Promise<ActionResult> {
  const res = await data.setTaskAppealedCsj(getDb(), await getActor(), id, appealed);
  if (res.success) {
    revalidatePath("/sarcini");
    revalidatePath(`/tasks/${id}`);
  }
  return res;
}

export async function finalizeTask(id: string): Promise<ActionResult> {
  const res = await data.finalizeTask(getDb(), await getActor(), id);
  if (res.success) {
    refreshLists();
    revalidatePath(`/tasks/${id}`);
  }
  return res;
}

export async function createTag(
  name: string,
  color: string,
): Promise<{ error?: string; tag?: { id: string; name: string; color: string } }> {
  return data.createTag(getDb(), await getActor(), name, color);
}

export async function updateTag(id: string, name: string, color: string): Promise<ActionResult> {
  const res = await data.updateTag(getDb(), await getActor(), id, name, color);
  if (res.success) refreshLists();
  return res;
}

export async function deleteTag(id: string): Promise<ActionResult> {
  const res = await data.deleteTag(getDb(), await getActor(), id);
  if (res.success) refreshLists();
  return res;
}

export async function attachTag(taskId: string, tagId: string): Promise<ActionResult> {
  const res = await data.attachTag(getDb(), await getActor(), taskId, tagId);
  if (res.success) {
    revalidatePath(`/tasks/${taskId}`);
    refreshLists();
  }
  return res;
}

export async function detachTag(taskId: string, tagId: string): Promise<ActionResult> {
  const res = await data.detachTag(getDb(), await getActor(), taskId, tagId);
  if (res.success) {
    revalidatePath(`/tasks/${taskId}`);
    refreshLists();
  }
  return res;
}

export async function addComment(taskId: string, body: string): Promise<ActionResult> {
  const res = await data.addComment(getDb(), await getActor(), taskId, body);
  if (res.success) revalidatePath(`/tasks/${taskId}`);
  return res;
}

export async function editComment(commentId: string, taskId: string, body: string): Promise<ActionResult> {
  const res = await data.editComment(getDb(), await getActor(), commentId, body);
  if (res.success) revalidatePath(`/tasks/${taskId}`);
  return res;
}

export async function deleteComment(commentId: string, taskId: string): Promise<ActionResult> {
  const res = await data.deleteComment(getDb(), await getActor(), commentId);
  if (res.success) revalidatePath(`/tasks/${taskId}`);
  return res;
}

// ===== Pași (subtask-uri) =====

export async function addSubtask(taskId: string, title: string): Promise<{ error?: string }> {
  const res = await data.addSubtask(getDb(), await getActor(), taskId, title);
  if (!res.error) revalidatePath(`/tasks/${taskId}`);
  return res;
}

export async function toggleSubtask(id: string, taskId: string, done: boolean): Promise<{ error?: string }> {
  const res = await data.toggleSubtask(getDb(), await getActor(), id, done);
  if (!res.error) {
    revalidatePath(`/tasks/${taskId}`);
    refreshLists();
  }
  return res;
}

export async function deleteSubtask(id: string, taskId: string): Promise<{ error?: string }> {
  const res = await data.deleteSubtask(getDb(), await getActor(), id);
  if (!res.error) revalidatePath(`/tasks/${taskId}`);
  return res;
}

export async function applyTemplateSubtasks(taskId: string): Promise<{ error?: string; added?: number }> {
  const res = await data.applyTemplateSubtasks(getDb(), await getActor(), taskId);
  if (!res.error && res.added) revalidatePath(`/tasks/${taskId}`);
  return res;
}
