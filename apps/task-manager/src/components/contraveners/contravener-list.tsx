"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { AlertTriangle, MailCheck, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContravenerDialog } from "@/components/contraveners/contravener-dialog";
import { setContravenerInformed } from "@/app/contravenienti/actions";
import {
  AVERTIZARE_ZILE,
  countPrescriptie,
  filterContraveners,
  fullName,
  matchesContravener,
  prescriptieOf,
  sortContraveners,
  type Contravener,
  type ContravenerFilter,
} from "@/lib/contraveners";
import { parseISODate } from "@/lib/periods";
import { cn } from "@/lib/utils";

function zi(iso: string): string {
  return format(parseISODate(iso), "d MMM yyyy", { locale: ro });
}

export function ContravenerList({
  contraveners,
  isAdmin,
  azi,
}: {
  contraveners: Contravener[];
  isAdmin: boolean;
  /** Ziua de azi pe ora Chișinăului, citită o dată pe server. */
  azi: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contravener | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContravenerFilter>("toti");
  const [, startTransition] = useTransition();

  // Cifrele pe tot registrul, nu pe ce rămâne după căutare: avertizarea de sus
  // spune câte hotărâri așteaptă informare, oricare ar fi numele căutat acum.
  const n = countPrescriptie(contraveners, azi);
  const rows = filterContraveners(sortContraveners(contraveners), filter, azi).filter((c) =>
    matchesContravener(c, search),
  );
  const ingustat = search.trim() !== "" || filter !== "toti";

  const deschide = (c: Contravener | null) => {
    setEditing(c);
    setOpen(true);
  };

  const setInformat = (c: Contravener, informat: boolean) => {
    startTransition(async () => {
      const res = await setContravenerInformed(c.id, informat);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        informat
          ? `${fullName(c)} — informarea e bifată ca expediată.`
          : `${fullName(c)} — bifa informării a fost scoasă.`,
      );
      router.refresh();
    });
  };

  const PASTILE: { value: ContravenerFilter; label: string; cate?: number }[] = [
    { value: "toti", label: "Toți" },
    { value: "de_informat", label: "De informat", cate: n.deInformat },
    { value: "expira_curand", label: `Expiră în ${AVERTIZARE_ZILE} de zile`, cate: n.expiraCurand },
  ];

  return (
    <div className="space-y-4">
      {/*
        Avertizarea stă deasupra a orice, nu doar în pastilă: după un an de la
        data definitivă hotărârea nu mai poate fi executată, iar informarea
        despre asta e un act care trebuie trimis. O cifră mică lângă un filtru
        se poate trece cu vederea; o bandă la intrarea în pagină, mai greu.
      */}
      {n.deInformat > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <span className="min-w-0 flex-1">
            {n.deInformat === 1
              ? "O hotărâre nu mai poate fi pusă în executare"
              : `${n.deInformat} hotărâri nu mai pot fi puse în executare`}{" "}
            — a trecut un an de la data devenirii definitive, iar informarea n-a fost încă
            bifată ca expediată.
          </span>
          {filter !== "de_informat" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-amber-300 bg-white px-2 text-xs hover:bg-amber-100"
              onClick={() => setFilter("de_informat")}
            >
              Arată-le
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută după nume…"
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {PASTILE.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setFilter(o.value)}
              aria-pressed={o.value === filter}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                o.value === filter
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {o.label}
              {/* Cifra doar când e ceva: „De informat (0)" ar cere o privire
                  ca să afli că n-ai nimic de făcut. */}
              {o.cate ? <span className="ml-1 tabular-nums">({o.cate})</span> : null}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" className="ml-auto" onClick={() => deschide(null)}>
          <Plus className="mr-1 h-4 w-4" /> Adaugă contravenient
        </Button>
      </div>

      {/* Cu o căutare sau un filtru activ se spune și din câți, altfel „3" ar
          putea fi citit drept tot registrul. */}
      <p className="text-[13px] tabular-nums text-muted-foreground">
        {ingustat
          ? `${rows.length} din ${contraveners.length}`
          : `${contraveners.length} în registru`}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-muted-foreground">
          {contraveners.length === 0
            ? "Niciun contravenient înscris."
            : filter === "de_informat" && !search.trim()
              ? "Nicio hotărâre prescrisă fără informare."
              : filter === "expira_curand" && !search.trim()
                ? `Niciun termen nu expiră în următoarele ${AVERTIZARE_ZILE} de zile.`
                : "Niciun nume nu se potrivește."}
        </div>
      ) : (
        /*
         * Fără derulare într-o parte, nici pe telefon.
         *
         * Pe ecran îngust coloanele de date nu încap lângă nume. Puse într-un
         * chenar care derulează orizontal, zilele și termenul — chiar ce se
         * caută aici — ar fi rămas ascunse după o glisare, adică exact defectul
         * reparat la Petiții pe 18 septembrie. Sub `sm` rândul se face pe două
         * linii: numele sus, datele dedesubt, cu etichetele scrise.
         */
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden items-center gap-3 border-b bg-muted/30 px-3.5 py-2 text-[11px] font-medium text-muted-foreground sm:flex">
            <span className="min-w-0 flex-1">Numele, prenumele, patronimicul</span>
            <span className="w-24 shrink-0">Hotărârea</span>
            <span className="w-24 shrink-0">Definitivă</span>
            <span className="w-12 shrink-0 text-right">Zile</span>
            <span className="w-44 shrink-0">Termenul de executare</span>
          </div>
          <div className="divide-y">
            {rows.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2 text-[13px] sm:flex-nowrap"
              >
                {/* Numele deschide fereastra; butonul de informare stă alături,
                    nu înăuntru — un buton în alt buton nu e HTML valid, iar
                    clicul pe „Informare expediată" ar fi deschis și fereastra. */}
                <button
                  type="button"
                  onClick={() => deschide(c)}
                  className="min-w-0 flex-1 text-left hover:underline"
                >
                  <span className="font-medium">{fullName(c)}</span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground sm:hidden">
                    hotărâre {zi(c.decision_date)} · definitivă{" "}
                    {c.final_date ? zi(c.final_date) : "—"} · {c.arrest_days} zile
                  </span>
                </button>
                <span className="hidden w-24 shrink-0 tabular-nums text-muted-foreground sm:block">
                  {zi(c.decision_date)}
                </span>
                {/* Linia spune „nu se știe încă", nu „nu e definitivă": câmpul
                    gol poate însemna oricare dintre cele două. */}
                <span
                  className="hidden w-24 shrink-0 tabular-nums text-muted-foreground sm:block"
                  title={c.final_date ? undefined : "Data devenirii definitive nu e încă trecută"}
                >
                  {c.final_date ? zi(c.final_date) : "—"}
                </span>
                <span className="hidden w-12 shrink-0 text-right font-medium tabular-nums sm:block">
                  {c.arrest_days}
                </span>
                <Termen c={c} azi={azi} onInformat={setInformat} />
              </div>
            ))}
          </div>
        </div>
      )}

      <ContravenerDialog
        open={open}
        onOpenChange={setOpen}
        contravener={editing}
        isAdmin={isAdmin}
        azi={azi}
      />
    </div>
  );
}

/**
 * Unde e hotărârea față de termenul de executare, într-o singură căsuță.
 *
 * Culorile sunt cele deja folosite în aplicație, cu același înțeles: chihlimbar
 * pentru ce cere atenție (ca „de înștiințat" la transferuri), verde pentru ce e
 * rezolvat, palid pentru ce nu cere nimic.
 */
function Termen({
  c,
  azi,
  onInformat,
}: {
  c: Contravener;
  azi: string;
  onInformat: (c: Contravener, informat: boolean) => void;
}) {
  const p = prescriptieOf(c, azi);
  return (
    <span className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:w-44">
      {p.stare === "executat" && (
        <span className="text-xs text-muted-foreground">Executat {zi(p.executatLa)}</span>
      )}
      {p.stare === "fara_data" && (
        <span className="text-xs text-muted-foreground" title="Se socotește din data devenirii definitive">
          fără dată definitivă
        </span>
      )}
      {p.stare === "in_termen" && (
        <span className="text-xs tabular-nums text-muted-foreground">până la {zi(p.ultimaZi)}</span>
      )}
      {p.stare === "expira_curand" && (
        <span
          className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-900"
          title={`Ultima zi de executare: ${zi(p.ultimaZi)}`}
        >
          {p.zileRamase === 0
            ? "Azi e ultima zi"
            : p.zileRamase === 1
              ? "Expiră mâine"
              : `Expiră în ${p.zileRamase} zile`}
        </span>
      )}
      {p.stare === "prescris" &&
        (p.informatLa ? (
          <button
            type="button"
            onClick={() => onInformat(c, false)}
            title="Scoate bifa informării"
            className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 transition-colors hover:bg-emerald-200"
          >
            <MailCheck className="h-3 w-3" aria-hidden />
            Informat {format(new Date(p.informatLa), "d MMM yyyy", { locale: ro })}
          </button>
        ) : (
          <>
            <span className="text-xs font-medium text-amber-900">
              Prescris din {zi(p.prescrisDin)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-amber-300 px-2 text-xs text-amber-900 hover:bg-amber-100"
              onClick={() => onInformat(c, true)}
            >
              <MailCheck className="mr-1 h-3.5 w-3.5" /> Informare expediată
            </Button>
          </>
        ))}
    </span>
  );
}
