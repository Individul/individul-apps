import { ArrowDown, ArrowUp } from "lucide-react";

import { PRIORITY_LABEL } from "@/components/tasks/meta";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/lib/types";

/**
 * Prioritatea unei sarcini, ca săgeată lângă titlu.
 *
 * Până acum o spunea banda colorată din stânga rândului, cu roșu pentru
 * „ridicată". Dar roșul înseamnă „restant" în restul aplicației, iar la
 * Petiții aceeași bandă arată termenul. Acum banda arată termenul în ambele
 * registre, iar prioritatea e o săgeată (29.10.2026).
 *
 * „Medie" e prioritatea implicită și nu primește semn: ar fi zgomot pe
 * jumătate din rânduri. Se văd doar abaterile: ↑ ridicată, ↓ scăzută.
 */
export function PriorityMark({
  priority,
  className,
  pastreazaLoc = false,
}: {
  priority: TaskPriority;
  className?: string;
  /** În listă: un loc gol la „medie", ca titlurile să înceapă toate din același punct. */
  pastreazaLoc?: boolean;
}) {
  if (priority === "medium") {
    return pastreazaLoc ? <span aria-hidden className={cn("w-3.5 shrink-0", className)} /> : null;
  }
  const Icon = priority === "high" ? ArrowUp : ArrowDown;
  const label = `Prioritate ${PRIORITY_LABEL[priority].toLowerCase()}`;
  return (
    <span title={label} aria-label={label} role="img" className={cn("inline-flex shrink-0", className)}>
      <Icon
        aria-hidden
        className={cn("h-3.5 w-3.5", priority === "high" ? "text-foreground" : "text-muted-foreground/70")}
        strokeWidth={priority === "high" ? 2.75 : 2}
      />
    </span>
  );
}
