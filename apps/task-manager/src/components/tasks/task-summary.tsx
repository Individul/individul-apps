import { isTaskOverdue } from "@/lib/hub-stats";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

function Stat({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-2xl font-medium tabular-nums leading-none">{value}</div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {dot ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}

export function TaskSummary({ tasks, label = "Rezumat" }: { tasks: Task[]; label?: string }) {
  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const waiting = tasks.filter((t) => t.status === "waiting").length;
  const done = tasks.filter((t) => t.status === "done").length;

  // `isTaskOverdue`, nu un calcul propriu: acesta scutește sarcinile în
  // așteptare, fiindcă un dosar plecat la instanță nu e restanța ta. Calculul
  // local de dinainte nu le scutea, așa că rezumatul arăta 8 restanțe acolo
  // unde bara laterală — care folosește filtrul comun — arăta 1. Două cifre
  // care se contrazic pe același ecran sunt mai rele decât o cifră lipsă.
  const overdue = tasks.filter((t) => isTaskOverdue(t)).length;

  const progress = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">{label}</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* În ordinea fluxului, iar totalul se închide: până acum lipsea „în
            așteptare", deci 17 + 1 + 9 nu dădeau 41 și nimeni nu putea spune
            unde s-au dus restul. */}
        <Stat label="Total" value={total} />
        <Stat label="De făcut" value={todo} dot="bg-slate-400" />
        <Stat label="În lucru" value={inProgress} dot="bg-blue-500" />
        <Stat label="În așteptare" value={waiting} dot="bg-violet-500" />
        <Stat label="Finalizate" value={done} dot="bg-green-500" />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Restante</span>
        <span className={cn("font-medium tabular-nums", overdue > 0 && "text-red-600")}>
          {overdue}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progres</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
