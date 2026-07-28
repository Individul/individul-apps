import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ModuleCardStat {
  label: string;
  value: number;
  tone?: "default" | "danger" | "warning";
}

export function ModuleCard({
  href,
  title,
  description,
  stats,
}: {
  href: string;
  title: string;
  description: string;
  stats: ModuleCardStat[];
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20 hover:bg-muted/40"
    >
      <h2 className="text-xl font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div
              className={cn(
                "text-2xl font-medium",
                s.tone === "danger" && s.value > 0 && "text-red-600",
                s.tone === "warning" && s.value > 0 && "text-amber-600",
              )}
            >
              {s.value}
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </Link>
  );
}
