import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/lib/types";

const ACTION_META: Record<
  AuditEntry["action"],
  { verb: string; Icon: typeof Plus; className: string }
> = {
  INSERT: { verb: "a creat", Icon: Plus, className: "bg-emerald-50 text-emerald-600" },
  UPDATE: { verb: "a modificat", Icon: Pencil, className: "bg-sky-50 text-sky-600" },
  DELETE: { verb: "a șters", Icon: Trash2, className: "bg-red-50 text-red-600" },
};

const ENTITY_LABEL: Record<AuditEntry["entity"], string> = {
  tasks: "sarcina",
  comments: "un comentariu la o sarcină",
  tags: "eticheta",
  task_tags: "o etichetă a unei sarcini",
  profiles: "utilizatorul",
};

function detailText(e: AuditEntry): string {
  const d = e.details ?? {};
  if (e.entity === "tasks" && d.title) return `„${String(d.title)}”`;
  if (e.entity === "tags" && d.name) return `„${String(d.name)}”`;
  if (e.entity === "profiles" && d.full_name) {
    const role = d.role ? ` (${String(d.role)})` : "";
    return `„${String(d.full_name)}”${role}`;
  }
  return "";
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nicio activitate înregistrată încă.</p>;
  }

  // Grupare pe zile (intrările vin deja sortate descrescător după dată).
  const groups: { key: string; label: string; items: AuditEntry[] }[] = [];
  for (const e of entries) {
    const key = format(parseISO(e.created_at), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({
        key,
        label: format(parseISO(e.created_at), "d MMMM yyyy", { locale: ro }),
        items: [e],
      });
    } else {
      last.items.push(e);
    }
  }

  return (
    <div className="max-h-[520px] space-y-6 overflow-auto rounded-lg border p-4">
      {groups.map((g) => (
        <div key={g.key} className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {g.label}
          </h3>
          <ul className="space-y-3">
            {g.items.map((e) => {
              const meta = ACTION_META[e.action];
              const Icon = meta?.Icon ?? Pencil;
              const detail = detailText(e);
              return (
                <li key={e.id} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      meta?.className ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{e.actor_name ?? "Sistem"}</span>{" "}
                      {meta?.verb ?? e.action} {ENTITY_LABEL[e.entity] ?? e.entity}
                      {detail ? ` ${detail}` : ""}
                    </p>
                    <p
                      className="mt-0.5 text-xs text-muted-foreground"
                      title={format(parseISO(e.created_at), "d MMM yyyy, HH:mm")}
                    >
                      {formatDistanceToNow(parseISO(e.created_at), {
                        addSuffix: true,
                        locale: ro,
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
