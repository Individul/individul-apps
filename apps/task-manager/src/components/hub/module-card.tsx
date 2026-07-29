import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";
import type { AssigneeCount } from "@/lib/hub-stats";

export interface ModuleCardStat {
  label: string;
  value: number;
  tone?: "default" | "danger" | "warning";
  /**
   * Totalul pe toată secția, afișat discret sub etichetă („din N”). Se dă doar
   * membrilor: la admin cifra proprie e deja totalul, deci ar fi redundant.
   */
  of?: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ModuleCard({
  href,
  title,
  description,
  stats,
  breakdown,
}: {
  href: string;
  title: string;
  description: string;
  stats: ModuleCardStat[];
  /** Defalcare pe responsabil (doar pentru admin). Lipsă → cardul arată doar cifrele. */
  breakdown?: AssigneeCount[];
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20 hover:bg-muted/40"
    >
      <h2 className="text-xl font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label}>
            <div
              className={cn(
                "text-2xl font-medium tabular-nums",
                s.tone === "danger" && s.value > 0 && "text-red-600",
                s.tone === "warning" && s.value > 0 && "text-amber-600",
              )}
            >
              {s.value}
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            {s.of !== undefined && (
              <div className="text-[11px] tabular-nums text-muted-foreground/70">
                din {s.of}
              </div>
            )}
          </div>
        ))}
      </div>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-5 space-y-2 border-t pt-4">
          {breakdown.map((row) => (
            <div key={row.id ?? "none"} className="flex items-center gap-2 text-sm">
              <Avatar className="h-6 w-6">
                <AvatarFallback className={cn("text-[10px]", avatarColor(row.id ?? "none"))}>
                  {initialsOf(row.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{row.name}</span>
              <span className="ml-auto flex items-center gap-2 tabular-nums">
                {row.overdue > 0 && (
                  <span className="text-xs text-red-600">{row.overdue} restante</span>
                )}
                <span className="text-muted-foreground">{row.count}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
