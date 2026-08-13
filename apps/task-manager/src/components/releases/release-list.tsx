"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { ReleaseDialog } from "@/components/releases/release-dialog";
import { Button } from "@/components/ui/button";
import { setReleaseDone } from "@/app/eliberari/actions";
import { parseISODate } from "@/lib/periods";
import {
  fullName,
  groundLabel,
  monthLabelRo,
  releaseState,
  shiftMonth,
  type ReleasePlan,
  type ReleaseState,
} from "@/lib/releases";
import { cn } from "@/lib/utils";

/**
 * Grupele, în ordinea în care cer ceva de la om.
 *
 * Restanțele sus, efectuatele jos. Nu e ordine cronologică și nu trebuie să
 * fie: cine deschide pagina dimineața caută ce n-a fost dus la capăt, nu ce
 * s-a terminat deja. Între „azi" și „urmează" diferența nici nu e de dată, ci
 * de faptul că una se face astăzi.
 *
 * Titlul grupei e semnul, culoarea doar îl repetă — aceeași hotărâre ca la
 * pastilele din `release-band.tsx`: „Restanțe" se citește la fel pe un ecran
 * alb-negru sau pe o fotocopie. Roșu peste portocaliu, în aceeași ordine ca
 * acolo, ca cele două ecrane să nu spună lucruri diferite cu aceleași culori.
 */
const GRUPE: { state: ReleaseState; title: string; header: string }[] = [
  { state: "restant", title: "Restanțe", header: "border-red-200 bg-red-50 text-red-900" },
  { state: "azi", title: "Azi", header: "border-orange-200 bg-orange-50 text-orange-900" },
  { state: "viitor", title: "Urmează", header: "bg-muted/30" },
  { state: "gata", title: "Efectuate", header: "bg-muted/30" },
];

const lunaHref = (month: string) => `/eliberari?luna=${month}`;

export function ReleaseList({
  plans,
  luna,
  today,
  isAdmin,
}: {
  plans: ReleasePlan[];
  /** Luna afișată, `AAAA-LL`. */
  luna: string;
  /** Ziua de azi la Chișinău, AAAA-LL-ZZ, trimisă de server. */
  today: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReleasePlan | null>(null);
  const [isPending, startTransition] = useTransition();

  const azi = parseISODate(today);
  // Cronologic în fiecare grupă — la restanțe asta înseamnă chiar cea care
  // așteaptă de cel mai mult timp prima.
  const randuri = [...plans].sort((a, b) => a.release_date.localeCompare(b.release_date));
  // Grupele goale dispar cu totul: un chenar „Restanțe 0" ar pune o vorbă
  // despre restanțe în fața cuiva care tocmai n-are niciuna.
  const grupe = GRUPE.map((g) => ({
    ...g,
    rows: randuri.filter((p) => releaseState(p, azi) === g.state),
  })).filter((g) => g.rows.length > 0);

  // Luna curentă se recunoaște din ziua trimisă de server, nu din ceasul
  // browserului: pe un calculator lăsat cu data greșită, legătura de întoarcere
  // ar lipsi exact când e nevoie de ea.
  const esteLunaCurenta = luna === today.slice(0, 7);

  const setDone = (plan: ReleasePlan, done: boolean) => {
    startTransition(async () => {
      const res = await setReleaseDone(plan.id, done);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        done ? `${fullName(plan)} — eliberat.` : `${fullName(plan)} — readus în listă.`,
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Săgeata, luna și săgeata nu se despart niciodată pe două rânduri:
            se citesc ca un singur lucru. Pe ecran îngust se rearanjează în
            jurul lor butoanele, nu ele. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href={lunaHref(shiftMonth(luna, -1))} aria-label="Luna precedentă">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          {/* Lățime minimă, ca săgețile să nu se mute de sub deget între
              „mai 2026" și „septembrie 2026". */}
          <span className="min-w-[7.5rem] text-center text-[13px] tabular-nums text-muted-foreground">
            {monthLabelRo(luna)}
          </span>
          {/* Spre deosebire de raportul săptămânal, înainte nu se oprește:
              eliberările se scriu cu săptămâni bune înainte, deci luna care vine
              chiar are ce arăta. */}
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href={lunaHref(shiftMonth(luna, 1))} aria-label="Luna următoare">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {!esteLunaCurenta && (
          <Button asChild variant="ghost" size="sm" className="h-9 shrink-0">
            <Link href="/eliberari">Luna curentă</Link>
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          className="ml-auto h-9 shrink-0"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Adaugă
        </Button>
      </div>

      {grupe.length === 0 ? (
        <p className="rounded-xl border bg-card px-3.5 py-6 text-center text-sm text-muted-foreground">
          Nicio eliberare înregistrată în {monthLabelRo(luna)}.
        </p>
      ) : (
        grupe.map((grup) => (
          <section key={grup.state} className="overflow-hidden rounded-xl border bg-card">
            <header
              className={cn(
                "flex items-center gap-2 border-b px-3.5 py-2 text-[13px]",
                grup.header,
              )}
            >
              <span className="font-medium">{grup.title}</span>
              <span className="ml-auto tabular-nums opacity-70">{grup.rows.length}</span>
            </header>

            <div className="divide-y">
              {grup.rows.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-start gap-3 px-3.5 py-2 text-[13px]",
                    p.done && "text-muted-foreground",
                  )}
                >
                  {/* Bifa stă în afara butonului care deschide fereastra:
                      înăuntru, fiecare bifare ar deschide și dialogul peste ea. */}
                  <input
                    type="checkbox"
                    checked={p.done}
                    disabled={isPending}
                    onChange={(e) => setDone(p, e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
                    aria-label={`Eliberat: ${fullName(p)}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left hover:underline"
                  >
                    {/* Ziua fără an și fără luna întreagă: amândouă scriu deja
                        deasupra butoanelor de navigare. Lățime fixă și aliniere
                        la dreapta, ca „1 aug" și „14 aug" să lase numele să
                        înceapă în același loc pe toată coloana. */}
                    <span className="w-[3.25rem] shrink-0 text-right tabular-nums text-muted-foreground">
                      {format(parseISODate(p.release_date), "d MMM", { locale: ro })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        {/* Numele nu se taie niciodată — un „Constantines…" nu
                            e om, e o ghicitoare. Temeiul da: el se recunoaște
                            și din început, iar pe ecran îngust trece pe rândul
                            de dedesubt înainte să ajungă să fie tăiat. */}
                        <span className="font-medium">{fullName(p)}</span>
                        <span className="min-w-0 truncate text-muted-foreground">
                          {groundLabel(p.ground)}
                        </span>
                      </span>
                      {p.note && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {p.note}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <ReleaseDialog open={open} onOpenChange={setOpen} plan={editing} isAdmin={isAdmin} />
    </div>
  );
}
