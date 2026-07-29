"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MODULES = [
  { href: "/sarcini", label: "Sarcini", matchPrefixes: ["/sarcini", "/tasks"] },
  { href: "/petitii", label: "Petiții", matchPrefixes: ["/petitii"] },
  { href: "/statistici", label: "Statistici", matchPrefixes: ["/statistici"] },
] as const;

export function ModuleTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {MODULES.map((m) => {
        const active = m.matchPrefixes.some(
          (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        );
        return (
          <Link
            key={m.href}
            href={m.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
