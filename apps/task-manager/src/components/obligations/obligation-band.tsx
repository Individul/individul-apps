import Link from "next/link";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { AlertTriangle, Clock } from "lucide-react";

import { needsAttention, sortPending, type Pending } from "@/lib/obligations";
import { parseISODate } from "@/lib/periods";
import { cn } from "@/lib/utils";

/**
 * Obligațiile apropiate sau restante, în capul paginii principale.
 *
 * Apare doar când e ceva de făcut. O bandă permanentă devine tapet: ochiul o
 * învață și n-o mai citește tocmai în ziua în care scrie ceva important.
 */
export function ObligationBand({ items }: { items: Pending[] }) {
  const rows = sortPending(items.filter(needsAttention));
  if (rows.length === 0) return null;

  const restante = rows.some((p) => p.overdue);

  return (
    <Link
      href="/obligatii"
      className={cn(
        "mb-6 block rounded-xl border px-4 py-3 transition-colors",
        restante
          ? "border-red-300 bg-red-50 hover:bg-red-100/70"
          : "border-amber-300 bg-amber-50 hover:bg-amber-100/70",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-[13px] font-medium",
          restante ? "text-red-900" : "text-amber-900",
        )}
      >
        {restante ? (
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {restante ? "Termene depășite" : "Termene apropiate"}
      </div>

      <ul className={cn("mt-1.5 space-y-1 text-[13px]", restante ? "text-red-900" : "text-amber-900")}>
        {rows.map((p) => (
          <li key={p.obligation.id} className="flex flex-wrap items-baseline gap-x-2">
            <span>{p.obligation.title}</span>
            <span className="opacity-80">
              — {p.obligation.recipient},{" "}
              {p.overdue
                ? `restant din ${format(parseISODate(p.due), "d MMMM", { locale: ro })}`
                : p.days === 0
                  ? "astăzi"
                  : `până pe ${format(parseISODate(p.due), "d MMMM", { locale: ro })}`}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
