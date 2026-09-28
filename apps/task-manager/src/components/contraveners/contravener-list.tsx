"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContravenerDialog } from "@/components/contraveners/contravener-dialog";
import {
  fullName,
  matchesContravener,
  sortContraveners,
  type Contravener,
} from "@/lib/contraveners";
import { parseISODate } from "@/lib/periods";

function zi(iso: string): string {
  return format(parseISODate(iso), "d MMM yyyy", { locale: ro });
}

export function ContravenerList({
  contraveners,
  isAdmin,
}: {
  contraveners: Contravener[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contravener | null>(null);
  const [search, setSearch] = useState("");

  const rows = sortContraveners(contraveners).filter((c) => matchesContravener(c, search));
  const cautare = search.trim() !== "";

  const deschide = (c: Contravener | null) => {
    setEditing(c);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută după nume…"
          className="max-w-xs"
        />
        {/* Cu o căutare activă se spune și din câți, altfel „3" ar putea fi
            citit drept tot registrul. */}
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {cautare
            ? `${rows.length} din ${contraveners.length}`
            : `${contraveners.length} în registru`}
        </span>
        <Button type="button" size="sm" className="ml-auto" onClick={() => deschide(null)}>
          <Plus className="mr-1 h-4 w-4" /> Adaugă contravenient
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-muted-foreground">
          {cautare ? "Niciun nume nu se potrivește cu căutarea." : "Niciun contravenient înscris."}
        </div>
      ) : (
        /*
         * Fără derulare într-o parte, nici pe telefon.
         *
         * Pe ecran îngust cele trei coloane de date nu încap lângă nume. Puse
         * într-un chenar care derulează orizontal, „Zile arest" — chiar cifra
         * pentru care se deschide registrul — ar fi rămas ascunsă după o
         * glisare, adică exact defectul reparat la Petiții pe 18 septembrie.
         * Sub `sm` rândul se face pe două linii: numele sus, datele și zilele
         * dedesubt, cu etichetele scrise, fiindcă antetul coloanelor lipsește.
         */
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden items-center gap-3 border-b bg-muted/30 px-3.5 py-2 text-[11px] font-medium text-muted-foreground sm:flex">
            <span className="min-w-0 flex-1">Numele, prenumele, patronimicul</span>
            <span className="w-28 shrink-0">Data hotărârii</span>
            <span className="w-28 shrink-0">Definitivă</span>
            <span className="w-16 shrink-0 text-right">Zile arest</span>
          </div>
          <div className="divide-y">
            {rows.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => deschide(c)}
                className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{fullName(c)}</span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground sm:hidden">
                    hotărâre {zi(c.decision_date)} · definitivă{" "}
                    {c.final_date ? zi(c.final_date) : "—"}
                  </span>
                </span>
                <span className="hidden w-28 shrink-0 tabular-nums text-muted-foreground sm:block">
                  {zi(c.decision_date)}
                </span>
                {/* Linia spune „nu se știe încă", nu „nu e definitivă": câmpul
                    gol poate însemna oricare dintre cele două. */}
                <span
                  className="hidden w-28 shrink-0 tabular-nums text-muted-foreground sm:block"
                  title={c.final_date ? undefined : "Data devenirii definitive nu e încă trecută"}
                >
                  {c.final_date ? zi(c.final_date) : "—"}
                </span>
                {/* Zilele rămân în coloana lor la orice lățime: sunt cifra după
                    care ochiul coboară pe listă. Pe telefon își spun unitatea,
                    fiindcă antetul care ar spune-o nu se vede. */}
                <span className="w-16 shrink-0 text-right font-medium tabular-nums">
                  {c.arrest_days}
                  <span className="font-normal text-muted-foreground sm:hidden"> zile</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ContravenerDialog
        open={open}
        onOpenChange={setOpen}
        contravener={editing}
        isAdmin={isAdmin}
      />
    </div>
  );
}
