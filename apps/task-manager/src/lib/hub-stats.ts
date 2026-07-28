import { parseISO } from "date-fns";
import type { Task, Petition, Profile } from "./types";

export interface ModuleStats {
  total: number;
  dueSoon: number;
  overdue: number;
}
export interface TaskStats extends ModuleStats {
  active: number;
}
export interface PetitionStats extends ModuleStats {
  open: number;
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
  let dueSoon = 0;
  let overdue = 0;
  for (const t of tasks) {
    if (t.status === "done") continue;
    active++;
    const c = classify(t.due_date, today);
    if (c === "overdue") overdue++;
    else if (c === "soon") dueSoon++;
  }
  return { total: tasks.length, active, dueSoon, overdue };
}

export interface AssigneeCount {
  id: string | null;
  name: string;
  count: number;
}

const UNASSIGNED = "Neatribuit";

/**
 * Grupează elementele pe responsabil, descrescător după număr (alfabetic la
 * egalitate). „Neatribuit” — inclusiv responsabilii care nu mai există în
 * `profiles` — apare mereu la final.
 */
export function countsByAssignee(
  items: { assignee_id: string | null }[],
  profiles: Profile[],
): AssigneeCount[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const counts = new Map<string | null, number>();

  for (const item of items) {
    const key = item.assignee_id && byId.has(item.assignee_id) ? item.assignee_id : null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows: AssigneeCount[] = [...counts].map(([id, count]) => ({
    id,
    name: id ? byId.get(id)!.full_name ?? "(fără nume)" : UNASSIGNED,
    count,
  }));

  return rows.sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return b.count - a.count || a.name.localeCompare(b.name, "ro");
  });
}

export function petitionStats(petitions: Petition[], today: Date = new Date()): PetitionStats {
  let open = 0;
  let dueSoon = 0;
  let overdue = 0;
  for (const p of petitions) {
    if (p.status !== "in_examinare") continue;
    open++;
    const c = classify(p.response_deadline, today);
    if (c === "overdue") overdue++;
    else if (c === "soon") dueSoon++;
  }
  return { total: petitions.length, open, dueSoon, overdue };
}
