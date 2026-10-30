"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Căutarea în jurnal (30.10.2026).
 *
 * Textul stă în adresă (`?cauta=`), lângă `modul`: căutarea se face pe server,
 * în tot jurnalul modulului ales, nu doar în cele 100 de intrări afișate, iar
 * tabul schimbat după aceea o păstrează (`AuditTabs` copiază parametrii).
 *
 * Se trimite la 350 ms după ultima tastă, nu la fiecare literă: fiecare
 * trimitere e o citire a jurnalului din D1.
 */
export function AuditSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(initial);
  const ultim = useRef(initial);

  useEffect(() => {
    if (text.trim() === ultim.current.trim()) return;
    const t = setTimeout(() => {
      ultim.current = text;
      const q = new URLSearchParams(params.toString());
      if (text.trim()) q.set("cauta", text.trim());
      else q.delete("cauta");
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
  }, [text, params, pathname, router]);

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Caută: nume, număr de petiție, cine, zi…"
        aria-label="Caută în jurnal"
        className="h-9 pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText("")}
          aria-label="Șterge căutarea"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
