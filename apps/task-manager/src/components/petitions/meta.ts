import { addDays, parseISO } from "date-fns";
import type { PetitionStatus, PetitionerType } from "@/lib/types";

export const STATUS_LABEL: Record<PetitionStatus, string> = {
  in_examinare: "În examinare",
  solutionat: "Soluționat",
};

export const STATUS_DOT: Record<PetitionStatus, string> = {
  in_examinare: "bg-amber-500",
  solutionat: "bg-green-600",
};

export const STATUS_OPTIONS: { value: PetitionStatus; label: string }[] = [
  { value: "in_examinare", label: "În examinare" },
  { value: "solutionat", label: "Soluționat" },
];

export const PETITIONER_LABEL: Record<PetitionerType, string> = {
  detinut: "Deținut",
  avocat: "Avocat",
  civil: "Persoană civilă",
};

export const PETITIONER_OPTIONS: { value: PetitionerType; label: string }[] = [
  { value: "detinut", label: "Deținut" },
  { value: "avocat", label: "Avocat" },
  { value: "civil", label: "Persoană civilă" },
];

// Termen = data înregistrării + 27 de zile (a 27-a zi calendaristică = ultima).
export function deadlineFrom(received: string): Date | null {
  if (!received) return null;
  try {
    return addDays(parseISO(received), 27);
  } catch {
    return null;
  }
}

// Zile rămase până la termen (negativ = restant). Se raportează la începutul zilei.
export function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = parseISO(deadline);
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}

// Normalizarea pentru căutare stă în @/lib/text; se re-exportă aici
// pentru importatorii existenți din modulul de petiții.
export { fold } from "@/lib/text";
