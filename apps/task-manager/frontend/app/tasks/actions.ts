"use server";

import { revalidatePath } from "next/cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function createTask(formData: FormData) {
  const data = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    status: formData.get("status") as string,
    priority: formData.get("priority") as string,
    category: formData.get("category") as string,
    deadline: formData.get("deadline") as string || null,
  };

  const response = await fetch(`${API_URL}/tasks/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create task");
  }

  revalidatePath("/");
  return response.json();
}

export async function updateTask(id: string, formData: FormData) {
  const data = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    status: formData.get("status") as string,
    priority: formData.get("priority") as string,
    category: formData.get("category") as string,
    deadline: formData.get("deadline") as string || null,
  };

  const response = await fetch(`${API_URL}/tasks/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update task");
  }

  revalidatePath("/");
  return response.json();
}

export async function deleteTask(id: string) {
  const response = await fetch(`${API_URL}/tasks/${id}/`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete task");
  }

  revalidatePath("/");
}
