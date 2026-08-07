import { optionsFrom } from "@/lib/options";
import type { TaskStatus } from "@/lib/types";

/**
 * Eticheta fiecărei stări, într-un singur loc.
 *
 * `Record<TaskStatus, string>` nu e decorativ: obligă compilatorul să ceară o
 * etichetă pentru fiecare stare din tip. Fără el, adăugarea stării „în
 * așteptare" a lăsat în urmă trei liste scrise de mână, fără ca nimic să se
 * plângă — puteai seta starea din formular, dar nu filtra după ea, iar în
 * rezumat cifrele nu se mai închideau (17 + 1 + 9 din 41).
 *
 * Ordinea e cea a fluxului de lucru, nu alfabetică. `Object.entries` o
 * păstrează, deci listele derivate ies în aceeași ordine.
 */
export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "De făcut",
  in_progress: "În lucru",
  waiting: "În așteptare",
  done: "Finalizat",
};

/** Aceleași stări, în forma cerută de listele derulante — derivată, nu scrisă. */
export const STATUS_OPTIONS = optionsFrom(STATUS_LABEL);
