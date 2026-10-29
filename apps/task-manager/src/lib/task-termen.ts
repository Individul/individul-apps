import type { StareTermen } from "@/lib/culori-termen";
import { isTaskDueSoon, isTaskOverdue, type TaskCounts } from "@/lib/hub-stats";
import { todayInChisinau } from "@/lib/periods";

/**
 * Unde stă sarcina față de termen, pentru banda din stânga rândului.
 *
 * Aceleași predicate ca filtrele și cardul de pe Acasă (`isTaskOverdue`,
 * `isTaskDueSoon`), ca banda să nu numere altfel decât „Restante". O sarcină
 * în așteptare are termenul oprit, deci nu e nici restantă, nici scadentă.
 */
export function termenSarcina(
  task: TaskCounts,
  today: Date = todayInChisinau(),
): { stare: StareTermen; eticheta: string } {
  if (task.status === "done") return { stare: "gata", eticheta: "Finalizată" };
  if (task.status === "waiting") return { stare: "inTermen", eticheta: "În așteptare: termenul e oprit" };
  if (isTaskOverdue(task, today)) return { stare: "restant", eticheta: "Restantă" };
  if (isTaskDueSoon(task, today)) return { stare: "scadent", eticheta: "Scadentă în 7 zile" };
  return { stare: "inTermen", eticheta: task.due_date ? "În termen" : "Fără termen" };
}
