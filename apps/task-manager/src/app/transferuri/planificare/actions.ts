"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCourt } from "@/lib/courts";
import { INSTITUTIONS } from "@/lib/transfers";
import type { TransferBasis } from "@/lib/transfer-plans";

type Result = { error?: string; success?: boolean };

export interface PlanInput {
  last_name: string;
  first_name: string;
  basis: TransferBasis;
  court: string;
  institution: string;
  /** Completată la temei „ședință". */
  hearing_date: string;
  /** Data parvenirii deciziei; completată la temei „decizie". */
  decision_date: string;
  note: string;
}

function validate(input: PlanInput): string | null {
  if (!input.last_name.trim()) return "Numele e obligatoriu.";
  if (!input.first_name.trim()) return "Prenumele e obligatoriu.";
  // Lista de instanțe e fixă în interfață; verificată și aici, fiindcă acțiunea
  // poate fi apelată și altfel decât prin formular.
  if (input.basis !== "sedinta" && input.basis !== "decizie") return "Alege temeiul.";
  if (!INSTITUTIONS.includes(Number(input.institution))) return "Alege penitenciarul.";

  /*
   * Oglindește constrângerea `transfer_plans_temei` din migrarea 0027.
   *
   * Verificat și aici, nu doar în bază: fără asta, un câmp lăsat gol s-ar
   * întoarce ca o eroare Postgres în engleză, despre o constrângere al cărei
   * nume nu-i spune nimic omului din fața ecranului.
   */
  if (input.basis === "sedinta") {
    // Lista de instanțe e fixă în interfață; verificată și aici, fiindcă
    // acțiunea poate fi apelată și altfel decât prin formular.
    if (!isCourt(input.court)) return "Alege instanța din listă.";
    if (!input.hearing_date) return "Data ședinței e obligatorie.";
  } else {
    // Instanța rămâne opțională: o decizie poate veni și din altă parte.
    if (input.court && !isCourt(input.court)) return "Alege instanța din listă.";
    if (!input.decision_date) return "Data parvenirii deciziei e obligatorie.";
  }
  return null;
}

export async function savePlan(id: string | null, input: PlanInput): Promise<Result> {
  const problem = validate(input);
  if (problem) return { error: problem };

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const values = {
    last_name: input.last_name.trim(),
    first_name: input.first_name.trim(),
    basis: input.basis,
    court: input.court ? input.court : null,
    institution: Number(input.institution),
    // Exact una dintre ele e completată — cealaltă se scrie `null` explicit, ca
    // o planificare mutată de pe un temei pe altul să nu păstreze data veche.
    hearing_date: input.basis === "sedinta" ? input.hearing_date : null,
    decision_date: input.basis === "decizie" ? input.decision_date : null,
    note: input.note.trim() ? input.note.trim() : null,
    updated_by: userId,
  };

  // `.select()` pe update, ca peste tot: un rând dispărut (șters de altcineva
  // cât era dialogul deschis) nu produce eroare, doar zero rânduri — iar fără
  // verificare am spune „Însemnare salvată." despre nimic.
  const { data, error } = id
    ? await supabase.from("transfer_plans").update(values).eq("id", id).select()
    : await supabase.from("transfer_plans").insert({ ...values, created_by: userId }).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/transferuri/planificare");
  return { success: true };
}

/** Încheiat după ședință: iese din listă, dar rămâne în evidență. */
export async function setPlanDone(id: string, done: boolean): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data, error } = await supabase
    .from("transfer_plans")
    .update({ done, updated_by: userId })
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/transferuri/planificare");
  return { success: true };
}

/**
 * Bifează că înștiințarea despre imposibilitatea executării a fost expediată.
 *
 * Se ține minte și ședința pentru care s-a trimis, nu doar data expedierii:
 * ziua de transfer se calculează din data ședinței, deci o amânare scoate omul
 * din grupul „de înștiințat", iar dacă se amână iarăși într-o zi imposibilă e
 * altă situație și cere altă hârtie. Vezi `esteInstiintat`.
 *
 * Ședința se citește din rândul din bază, nu din ce trimite pagina: între
 * încărcarea listei și apăsarea butonului, altcineva poate să fi mutat data —
 * iar atunci bifa ar fi ajuns pe ședința veche, care nu mai există.
 */
export async function setPlanNotified(id: string, notified: boolean): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { data: rand, error: eCitire } = await supabase
    .from("transfer_plans")
    .select("hearing_date")
    .eq("id", id)
    .maybeSingle();
  if (eCitire) return { error: eCitire.message };
  if (!rand) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }
  if (notified && !rand.hearing_date) {
    // Grupul „de înștiințat" apare numai la ședințe; fără dată n-ar avea ce
    // acoperi hârtia.
    return { error: "Însemnarea n-are dată de ședință, deci nu are ce înștiința." };
  }

  const values = notified
    ? {
        notified_at: new Date().toISOString(),
        notified_by: userId,
        notified_hearing_date: rand.hearing_date,
        updated_by: userId,
      }
    : {
        notified_at: null,
        notified_by: null,
        notified_hearing_date: null,
        updated_by: userId,
      };

  const { data, error } = await supabase
    .from("transfer_plans")
    .update(values)
    .eq("id", id)
    .select();
  if (error) {
    // Până se aplică migrarea 0029, coloanele nu există, iar Postgres o spune
    // în limba lui. Cine apasă butonul are nevoie să afle ce e de făcut, nu
    // cum se numește coloana lipsă.
    if (/notified_/.test(error.message)) {
      return {
        error:
          "Bifa înștiințării nu poate fi salvată: migrarea 0029 nu e aplicată în baza de date.",
      };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "Însemnarea nu mai există — probabil a fost ștearsă. Reîncarcă pagina." };
  }

  revalidatePath("/transferuri/planificare");
  return { success: true };
}

export async function deletePlan(id: string): Promise<Result> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transfer_plans")
    .delete()
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Însemnarea nu există sau nu ai dreptul." };
  revalidatePath("/transferuri/planificare");
  return { success: true };
}
