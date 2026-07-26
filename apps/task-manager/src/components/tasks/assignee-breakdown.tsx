import type { Profile, Task } from "@/lib/types";

interface Row {
  id: string;
  name: string;
  open: number;
  done: number;
  total: number;
}

export function AssigneeBreakdown({ tasks, profiles }: { tasks: Task[]; profiles: Profile[] }) {
  const rows: Row[] = profiles
    .map((p) => {
      const own = tasks.filter((t) => t.assignee_id === p.id);
      const done = own.filter((t) => t.status === "done").length;
      return {
        id: p.id,
        name: p.full_name ?? "(fără nume)",
        open: own.length - done,
        done,
        total: own.length,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const unassigned = tasks.filter((t) => !t.assignee_id).length;
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Pe responsabil
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nicio sarcină atribuită.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {r.open} deschise · {r.done} gata
                </span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-blue-500" style={{ width: `${(r.open / max) * 100}%` }} />
                <div className="h-full bg-green-500" style={{ width: `${(r.done / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {unassigned > 0 && (
        <p className="text-xs text-muted-foreground">Neatribuite: {unassigned}</p>
      )}
    </div>
  );
}
