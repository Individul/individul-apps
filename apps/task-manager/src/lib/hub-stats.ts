import { parseISO } from "date-fns";
import type { Task, Petition, Profile } from "./types";

export interface ModuleStats {
  total: number;
  dueSoon: number;
  overdue: number;
}
export interface TaskStats extends ModuleStats {
  active: number;
  done: number;
  /** Sarcini care depind de un răspuns extern — nu intră în restanțe. */
  waiting: number;
}
export interface PetitionStats extends ModuleStats {
  open: number;
  solved: number;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Clasifică un termen față de „azi”: restant, scadent în ≤7 zile, sau nici una. */
function classify(deadline: string | null, today: Date): "overdue" | "soon" | "none" {
  if (!deadline) return "none";
  const start = startOfDay(today);
  const due = startOfDay(parseISO(deadline));
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  return "none";
}

export function taskStats(tasks: Task[], today: Date = new Date()): TaskStats {
  let active = 0;
  let done = 0;
  let waiting = 0;
  let dueSoon = 0;
  let overdue = 0;
  for (const t of tasks) {
    if (t.status === "done") {
      done++;
      continue;
    }
    active++;
    // Cât depinde de instanță, termenul nu curge: nici restantă, nici scadentă.
    if (t.status === "waiting") {
      waiting++;
      continue;
    }
    const c = classify(t.due_date, today);
    if (c === "overdue") overdue++;
    else if (c === "soon") dueSoon++;
  }
  return { total: tasks.length, active, done, waiting, dueSoon, overdue };
}

export interface AssigneeCount {
  id: string | null;
  name: string;
  count: number;
  overdue: number;
}

const UNASSIGNED = "Neatribuit";

/**
 * O sarcină e restantă dacă are termen trecut și nu e finalizată — dar nu și
 * cât timp așteaptă răspuns extern: acolo întârzierea nu e a responsabilului.
 */
export function isTaskOverdue(task: Task, today: Date = new Date()): boolean {
  if (task.status === "done" || task.status === "waiting") return false;
  return classify(task.due_date, today) === "overdue";
}

/** O petiție e restantă dacă are termen de răspuns trecut și e încă în examinare. */
export function isPetitionOverdue(petition: Petition, today: Date = new Date()): boolean {
  return (
    petition.status === "in_examinare" &&
    classify(petition.response_deadline, today) === "overdue"
  );
}

/**
 * Grupează elementele pe responsabil, descrescător după număr (alfabetic la
 * egalitate). „Neatribuit” — inclusiv responsabilii care nu mai există în
 * `profiles` — apare mereu la final. Cu `isOverdue` se numără separat și câte
 * dintre elementele fiecăruia sunt restante.
 */
export function countsByAssignee<T extends { assignee_id: string | null }>(
  items: T[],
  profiles: Profile[],
  isOverdue?: (item: T) => boolean,
): AssigneeCount[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const counts = new Map<string | null, { count: number; overdue: number }>();

  for (const item of items) {
    const key = item.assignee_id && byId.has(item.assignee_id) ? item.assignee_id : null;
    const row = counts.get(key) ?? { count: 0, overdue: 0 };
    row.count++;
    if (isOverdue?.(item)) row.overdue++;
    counts.set(key, row);
  }

  const rows: AssigneeCount[] = [...counts].map(([id, { count, overdue }]) => ({
    id,
    name: id ? byId.get(id)!.full_name ?? "(fără nume)" : UNASSIGNED,
    count,
    overdue,
  }));

  return rows.sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return b.count - a.count || a.name.localeCompare(b.name, "ro");
  });
}

export function petitionStats(petitions: Petition[], today: Date = new Date()): PetitionStats {
  let open = 0;
  let solved = 0;
  let dueSoon = 0;
  let overdue = 0;
  for (const p of petitions) {
    if (p.status !== "in_examinare") {
      if (p.status === "solutionat") solved++;
      continue;
    }
    open++;
    const c = classify(p.response_deadline, today);
    if (c === "overdue") overdue++;
    else if (c === "soon") dueSoon++;
  }
  return { total: petitions.length, open, solved, dueSoon, overdue };
}
