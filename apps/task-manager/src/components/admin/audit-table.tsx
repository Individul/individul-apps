import { format, parseISO } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditEntry } from "@/lib/types";

const ACTION_LABEL: Record<AuditEntry["action"], string> = {
  INSERT: "Creat",
  UPDATE: "Modificat",
  DELETE: "Șters",
};

const ENTITY_LABEL: Record<AuditEntry["entity"], string> = {
  tasks: "Sarcină",
  comments: "Comentariu",
  tags: "Etichetă",
  task_tags: "Etichetă atașată",
  profiles: "Utilizator",
};

function detailText(e: AuditEntry): string {
  const d = e.details ?? {};
  if (e.entity === "tasks") return String(d.title ?? "");
  if (e.entity === "tags") return String(d.name ?? "");
  if (e.entity === "profiles") {
    const name = d.full_name ? String(d.full_name) : "";
    const role = d.role ? ` (${String(d.role)})` : "";
    return `${name}${role}`.trim();
  }
  return "";
}

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nicio activitate înregistrată încă.</p>;
  }
  return (
    <div className="max-h-[520px] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">Când</TableHead>
            <TableHead>Cine</TableHead>
            <TableHead>Acțiune</TableHead>
            <TableHead>Tip</TableHead>
            <TableHead>Detaliu</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {format(parseISO(e.created_at), "d MMM yyyy, HH:mm")}
              </TableCell>
              <TableCell>
                {e.actor_name ?? <span className="text-muted-foreground">Sistem</span>}
              </TableCell>
              <TableCell>{ACTION_LABEL[e.action] ?? e.action}</TableCell>
              <TableCell>{ENTITY_LABEL[e.entity] ?? e.entity}</TableCell>
              <TableCell className="max-w-[280px] truncate" title={detailText(e)}>
                {detailText(e) || <span className="text-muted-foreground">—</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
