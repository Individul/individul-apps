"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PERIODS, type Period } from "@/lib/periods";
import { cn } from "@/lib/utils";

/** Bara de deasupra raportului. Nu se tipărește — vezi clasa `no-print`. */
export function ReportToolbar({ period }: { period: Period }) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (next: Period) => {
    const q = new URLSearchParams(params.toString());
    q.set("perioada", next);
    router.push(`/sedinte/raport?${q.toString()}`);
  };

  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-2 border-b pb-4">
      <Link
        href="/sedinte"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Ședințe
      </Link>

      <div className="ml-4 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => go(p.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              p.value === period
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Button type="button" size="sm" className="ml-auto" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" /> Tipărește
      </Button>
    </div>
  );
}
