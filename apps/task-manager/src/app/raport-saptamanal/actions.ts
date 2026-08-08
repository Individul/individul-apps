"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; success?: boolean };

const LIPSA =
  "Ziua nu s-a putut salva — probabil nu mai ai dreptul s-o scrii. Reîncarcă pagina.";

/** Cifra vine din formular ca text; negativul și non-numericul cad aici. */
function toCount(value: unknown): number | string {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "Eliberați: introdu un număr întreg.";
  // Aceeași limită ca `check (count >= 0)` din migrarea 0026.
  if (n < 0) return "Eliberați: numărul nu poate fi negativ.";
  return n;
}

/**
 * Scrie eliberările unei zile. Un rând pe zi, deci a doua introducere pentru
 * aceeași dată o corectează pe prima — cine a schimbat și din ce în ce rămâne
 * în jurnalul de audit.
 *
 * Zero e o valoare validă: pe o zi în care n-a ieșit nimeni, zeroul e singurul
 * fel de a spune că ziua a fost verificată, nu uitată.
 */
export async function saveRelease(date: string, count: unknown, note: string): Promise<Result> {
  if (!date) return { error: "Alege ziua." };

  const cifra = toCount(count);
  if (typeof cifra === "string") return { error: cifra };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  // `release_date` e unic, deci `upsert` pe ea în loc de o inserare oarbă: doi
  // colegi care salvează aceeași zi în același moment obțin o corectare, nu
  // eroarea de duplicat pe care ar trebui s-o descifreze cineva.
  //
  // `created_by` se citește înainte și se pune la loc: `upsert` rescrie toate
  // coloanele trimise, iar fără asta prima corectare făcută de altcineva ar
  // șterge cine a deschis ziua (motivul pentru care `sedinte/actions.ts` a
  // ocolit cu totul upsertul).
  const { data: existing } = await supabase
    .from("releases")
    .select("created_by")
    .eq("release_date", date)
    .maybeSingle();

  // `.select()` nu e decor: un rând filtrat de RLS nu produce eroare, deci fără
  // el am raporta succes pentru o salvare care nu s-a întâmplat.
  const { data, error } = await supabase
    .from("releases")
    .upsert(
      {
        release_date: date,
        count: cifra,
        note: note.trim() ? note.trim() : null,
        created_by: (existing?.created_by as string | null) ?? userId,
        updated_by: userId,
      },
      { onConflict: "release_date" },
    )
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: LIPSA };

  revalidatePath("/raport-saptamanal");
  return { success: true };
}
