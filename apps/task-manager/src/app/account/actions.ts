"use server";

import { revalidatePath } from "next/cache";

import { getActor, getSessionToken } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as data from "@/lib/data/account";

export async function changePassword(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  return data.changePassword(
    getDb(),
    await getActor(),
    String(formData.get("password") || ""),
    String(formData.get("confirm") || ""),
    await getSessionToken(),
  );
}

/**
 * La eroare se întorc și valorile scrise: React 19 golește formularul după
 * fiecare trimitere, iar un „username deja folosit" ar fi șters tot ce a scris
 * omul, întorcându-l la valorile vechi.
 */
export async function updateProfile(
  _prev: { error?: string; success?: boolean; values?: { full_name: string; username: string } } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean; values?: { full_name: string; username: string } }> {
  const values = {
    full_name: String(formData.get("full_name") || ""),
    username: String(formData.get("username") || ""),
  };
  const res = await data.updateProfile(getDb(), await getActor(), values.full_name, values.username);
  if (res.success) {
    revalidatePath("/");
    revalidatePath("/sarcini");
    revalidatePath("/admin");
    return res;
  }
  return { ...res, values };
}
