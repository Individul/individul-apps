import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { Clock, Pencil, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  todo: "De făcut",
  in_progress: "În lucru",
  done: "Finalizat",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Scăzută",
  medium: "Medie",
  high: "Ridicată",
};

function fmtDue(v: unknown): string {
  if (!v) return "fără termen";
  try {
    return format(parseISO(String(v)), "d MMM yyyy");
  } catch {
    return String(v);
  }
}

function changeLines(e: AuditEntry): string[] {
  const d = e.details ?? {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(d, k);
  const out: string[] = [];
  if (has("status_to")) {
    out.push(
      `Stare: ${STATUS_LABEL[String(d.status_from)] ?? "—"} → ${STATUS_LABEL[String(d.status_to)] ?? "—"}`,
    );
  }
  if (has("priority_to")) {
    out.push(
      `Prioritate: ${PRIORITY_LABEL[String(d.priority_from)] ?? "—"} → ${PRIORITY_LABEL[String(d.priority_to)] ?? "—"}`,
    );
  }
  if (has("assignee_to")) {
    out.push(
      `Responsabil: ${d.assignee_from ? String(d.assignee_from) : "Neatribuit"} → ${d.assignee_to ? String(d.assignee_to) : "Neatribuit"}`,
    );
  }
  if (has("due_to")) out.push(`Termen: ${fmtDue(d.due_from)} → ${fmtDue(d.due_to)}`);
  if (has("title_to")) out.push("Titlu modificat");
  return out;
}

export function TaskHistory({ entries }: { entries: AuditEntry[] }) {
  if (!entries || entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Istoric
      </h2>
      <ul className="space-y-3">
        {entries.map((e) => {
          const created = e.action === "INSERT";
          const cl = created ? [] : changeLines(e);
          const Icon = created ? Plus : Pencil;
          return (
            <li key={e.id} className="flex gap-3 text-sm">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  created ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600",
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-medium">{e.actor_name ?? "Sistem"}</span>{" "}
                  {created ? "a creat sarcina" : "a modificat sarcina"}
                </p>
                {cl.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                    {cl.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                )}
                <p
                  className="mt-0.5 text-xs text-muted-foreground"
                  title={format(parseISO(e.created_at), "d MMM yyyy, HH:mm")}
                >
                  {format(parseISO(e.created_at), "d MMM yyyy, HH:mm", { locale: ro })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
