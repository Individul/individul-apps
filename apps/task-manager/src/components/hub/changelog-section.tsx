"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";

import { CHANGELOG, HUB_CHANGELOG_COUNT, isNewSince } from "@/lib/changelog";

const STORAGE_KEY = "changelog-seen";

export function ChangelogSection() {
  // localStorage nu există la randarea pe server: se citește după montare, ca
  // marcajul „nou" să nu producă nepotrivire de hidratare. Tot atunci se
  // însemnează vizita, deci marcajele dispar la următoarea intrare.
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    setLastSeen(window.localStorage.getItem(STORAGE_KEY));
    const newest = CHANGELOG[0]?.date;
    if (newest) window.localStorage.setItem(STORAGE_KEY, newest);
  }, []);

  const shown = CHANGELOG.slice(0, HUB_CHANGELOG_COUNT);
  if (shown.length === 0) return null;

  return (
    // Aceeași formă ca a cardurilor de modul: stă alături de ele în grilă, nu
    // dedesubt, deci ar arăta străin cu alt chenar și alt titlu.
    <section className="rounded-xl border bg-card p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-medium">Noutăți</h2>
        {CHANGELOG.length > shown.length && (
          <Link
            href="/noutati"
            className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Vezi toate
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Ce s-a schimbat în aplicație în ultima vreme.
      </p>
      <ul className="mt-5 space-y-1.5">
        {shown.map((entry) => (
          <li key={`${entry.date}-${entry.text}`} className="flex items-baseline gap-3">
            <span className="w-14 shrink-0 tabular-nums text-xs text-muted-foreground">
              {format(parseISO(entry.date), "d MMM", { locale: ro })}
            </span>
            <span className="min-w-0 flex-1 text-[13px] leading-relaxed">{entry.text}</span>
            {isNewSince(entry.date, lastSeen) && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                nou
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
