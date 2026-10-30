import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import {
  ArrowLeftRight,
  Scale,
  CalendarClock,
  DoorOpen,
  UserRound,
  Gavel,
  Hourglass,
  ListChecks,
  Mail,
  MessageSquare,
  Paperclip,
  Pencil,
  Tag as TagIcon,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/lib/types";
import { laChisinau } from "@/lib/periods";
import { frazaJurnal } from "@/lib/audit-text";

// Iconița spune din ce modul e intrarea, culoarea spune ce s-a întâmplat.
// Verbul e oricum scris în frază, deci culoarea nu poartă singură înțelesul.
const ACTION_CLASS: Record<AuditEntry["action"], string> = {
  INSERT: "bg-emerald-50 text-emerald-600",
  UPDATE: "bg-sky-50 text-sky-600",
  DELETE: "bg-red-50 text-red-600",
};

const ENTITY_ICON: Record<AuditEntry["entity"], typeof Pencil> = {
  tasks: ListChecks,
  subtasks: ListChecks,
  comments: MessageSquare,
  tags: TagIcon,
  task_tags: TagIcon,
  petitions: Mail,
  petition_attachments: Paperclip,
  hearings: Gavel,
  transfers: ArrowLeftRight,
  transfer_plans: UserRound,
  obligations: CalendarClock,
  defendants: Scale,
  contraveners: Hourglass,
  releases: DoorOpen,
  obligation_completions: CalendarClock,
  profiles: Users,
};

export function AuditTable({
  entries,
  gol = "Nicio activitate înregistrată încă.",
}: {
  entries: AuditEntry[];
  /** Ce se scrie la listă goală; `null` când pagina o spune deja (la căutare). */
  gol?: string | null;
}) {
  if (entries.length === 0) {
    return gol ? <p className="text-sm text-muted-foreground">{gol}</p> : null;
  }

  // Grupare pe zile (intrările vin deja sortate descrescător după dată).
  const groups: { key: string; label: string; items: AuditEntry[] }[] = [];
  for (const e of entries) {
    const key = format(laChisinau(e.created_at), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({
        key,
        label: format(laChisinau(e.created_at), "d MMMM yyyy", { locale: ro }),
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
              const actionClass = ACTION_CLASS[e.action];
              const Icon = ENTITY_ICON[e.entity] ?? Pencil;
              return (
                <li key={e.id} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      actionClass ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{e.actor_name ?? "Sistem"}</span>{" "}
                      {frazaJurnal(e)}
                    </p>
                    <p
                      className="mt-0.5 text-xs text-muted-foreground"
                      title={format(laChisinau(e.created_at), "d MMM yyyy, HH:mm", { locale: ro })}
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
