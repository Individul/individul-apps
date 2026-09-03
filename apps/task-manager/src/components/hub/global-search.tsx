"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { searchAll } from "@/app/cautare/actions";
import { MIN_QUERY, countHits, type SearchGroup } from "@/lib/search";

/**
 * Căutarea peste toate registrele, în capul paginii principale.
 *
 * Întrebarea la care răspunde e „ce avem pe X?", nu „unde e petiția asta" —
 * pentru a doua, fiecare modul își are filtrul lui. De aceea rezultatele stau
 * grupate pe registre: cine caută un nume vrea să vadă dintr-o privire în câte
 * locuri apare, nu o listă amestecată din care să deducă singur.
 */
export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [cauta, setCauta] = useState(false);
  const [deschis, setDeschis] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  /*
   * Se așteaptă o clipă după ultima tastă.
   *
   * Fără pauza asta, „Țiganciuc" ar porni zece căutări, iar răspunsurile lor
   * s-ar putea întoarce în altă ordine decât au plecat — ultima tastă cu
   * rezultatele penultimei. `anulat` taie și răspunsul întârziat al unei
   * căutări care nu mai interesează.
   */
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setGroups([]);
      setCauta(false);
      return;
    }
    let anulat = false;
    setCauta(true);
    const t = setTimeout(() => {
      void searchAll(q).then((g) => {
        if (anulat) return;
        setGroups(g);
        setCauta(false);
      });
    }, 250);
    return () => {
      anulat = true;
      clearTimeout(t);
    };
  }, [query]);

  // Click în afară sau Escape închide panoul, dar nu golește ce ai scris:
  // cine îl redeschide caută de obicei același lucru.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setDeschis(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeschis(false);
    };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, []);

  const q = query.trim();
  const arataPanou = deschis && q.length >= MIN_QUERY;
  const total = countHits(groups);

  return (
    <div ref={wrap} className="relative mb-6">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setDeschis(true);
        }}
        onFocus={() => setDeschis(true)}
        placeholder="Caută un nume în toate registrele — sarcini, petiții, transferuri, preveniți"
        aria-label="Caută în toate registrele"
        className="pl-9 pr-9"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setDeschis(false);
          }}
          aria-label="Șterge căutarea"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {arataPanou && (
        <div className="absolute z-20 mt-2 max-h-[28rem] w-full overflow-y-auto rounded-xl border bg-card shadow-lg">
          {cauta && groups.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Se caută…
            </p>
          ) : total === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Nimic pentru „{q}”.
            </p>
          ) : (
            <div className="divide-y">
              {groups.map((g) => (
                <div key={g.kind} className="py-1.5">
                  <div className="px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </div>
                  {g.hits.map((h) => (
                    <Link
                      key={h.id}
                      href={h.href}
                      onClick={() => setDeschis(false)}
                      className="block px-4 py-2 transition-colors hover:bg-accent"
                    >
                      <div className="truncate text-[13px]">{h.title}</div>
                      {h.detail && (
                        <div className="truncate text-xs text-muted-foreground">{h.detail}</div>
                      )}
                    </Link>
                  ))}
                  {g.more > 0 && (
                    <p className="px-4 py-1 text-xs text-muted-foreground">
                      încă {g.more} — caută în modul pentru toate
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
