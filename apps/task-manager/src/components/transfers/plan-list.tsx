"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { AlertTriangle, Check, MailCheck, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PlanDialog } from "@/components/transfers/plan-dialog";
import { setPlanDone, setPlanNotified } from "@/app/transferuri/planificare/actions";
import {
  esteInstiintat,
  groupByTransferDay,
  planDate,
  type TransferPlan,
} from "@/lib/transfer-plans";
import { institutionLabel } from "@/lib/transfers";
import { parseISODate } from "@/lib/periods";

/**
 * Data de care atârnă planificarea, spusă cu numele ei.
 *
 * „Ședința" și „decizia" cer transferul în direcții opuse — una înainte, alta
 * după — deci un rând care arată doar o dată, fără să spună care, s-ar citi
 * greșit exact când contează.
 */
function dataPlanului(p: TransferPlan): string {
  const iso = planDate(p);
  if (!iso) return "—";
  const zi = format(parseISODate(iso), "d MMM yyyy", { locale: ro });
  return p.basis === "decizie" ? `decizie, ${zi}` : `ședință, ${zi}`;
}
import { cn } from "@/lib/utils";

export function PlanList({
  plans,
  isAdmin,
}: {
  plans: TransferPlan[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransferPlan | null>(null);
  const [, startTransition] = useTransition();

  const groups = groupByTransferDay(plans);
  // Cele mai noi primele: cine caută un „Încheiat" apăsat din greșeală îl
  // caută pe cel de adineauri, nu pe cel de acum trei luni.
  const incheiate = plans
    .filter((p) => p.done)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const setInstiintat = (plan: TransferPlan, instiintat: boolean) => {
    startTransition(async () => {
      const res = await setPlanNotified(plan.id, instiintat);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        instiintat
          ? `${plan.last_name} ${plan.first_name} — înștiințarea e bifată ca expediată.`
          : `${plan.last_name} ${plan.first_name} — bifa înștiințării a fost scoasă.`,
      );
      router.refresh();
    });
  };

  const setDone = (plan: TransferPlan, done: boolean) => {
    startTransition(async () => {
      const res = await setPlanDone(plan.id, done);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        done
          ? `${plan.last_name} ${plan.first_name} — încheiat.`
          : `${plan.last_name} ${plan.first_name} — readus în listă.`,
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {groups.length === 0
            ? "Nicio persoană în așteptare."
            : `${groups.reduce((n, g) => n + g.plans.length, 0)} persoane de transferat`}
        </p>
        <Button
          type="button"
          size="sm"
          className="ml-auto h-7"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Adaugă persoană
        </Button>
      </div>

      {/* Antetul apare o singură dată, deasupra grupurilor: fără el, data din
          rând se putea confunda cu ziua transferului scrisă în capul grupului. */}
      {groups.length > 0 && (
        <div className="flex items-center gap-3 px-3.5 text-[11px] font-medium text-muted-foreground">
          <span className="min-w-0 flex-1">Persoana și instanța</span>
          <span className="w-40 shrink-0">Penitenciarul</span>
          <span className="w-28 shrink-0">Data ședinței</span>
          {/* Lățime egală în antet și în rânduri, deși în grupurile obișnuite
              rămâne mai goală: la „de înștiințat" mai încape un buton, iar dacă
              lățimea ar diferi de la un grup la altul, coloanele fixe dinaintea
              ei s-ar deplasa doar acolo. */}
          <span className="w-56 shrink-0" aria-hidden />
        </div>
      )}

      {groups.map((group) => {
        const imposibil = group.day === null;
        // Câți din grup mai așteaptă hârtia. Antetul care ar spune mai departe
        // „De înștiințat instanța" după ce toate au plecat ar cere o muncă
        // deja făcută — iar cine îl citește de la distanță ar crede că a rămas
        // ceva de trimis.
        const deTrimis = imposibil ? group.plans.filter((p) => !esteInstiintat(p)).length : 0;
        return (
          <section
            key={group.day ?? "imposibil"}
            className={cn(
              "overflow-hidden rounded-xl border bg-card",
              imposibil && (deTrimis > 0 ? "border-amber-300" : "border-emerald-300"),
            )}
          >
            <header
              className={cn(
                "flex items-center gap-2 border-b px-3.5 py-2 text-[13px]",
                !imposibil && "bg-muted/30",
                // Chihlimbariul cheamă la o faptă. După ce hârtiile au plecat,
                // grupul rămâne deosebit — oamenii tot nu pot fi transferați —
                // dar nu mai strigă după ceva ce s-a făcut.
                imposibil && (deTrimis > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"),
              )}
            >
              {imposibil ? (
                <>
                  {deTrimis > 0 ? (
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <MailCheck className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <span className="font-medium">
                    {deTrimis > 0
                      ? "De înștiințat instanța — nu mai există zi de transfer înainte de ședință"
                      : "Instanțele au fost înștiințate — nu mai există zi de transfer înainte de ședință"}
                  </span>
                  {deTrimis > 0 && group.plans.length > deTrimis && (
                    <span className="shrink-0 rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-medium">
                      {deTrimis} de trimis
                    </span>
                  )}
                </>
              ) : (
                <span className="font-medium">
                  Transfer pe{" "}
                  {format(parseISODate(group.day!), "EEEE, d MMMM yyyy", { locale: ro })}
                </span>
              )}
              <span className="ml-auto tabular-nums text-muted-foreground">
                {group.plans.length}
              </span>
            </header>

            <div className="divide-y">
              {group.plans.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3.5 py-2 text-[13px]">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                    className="min-w-0 flex-1 text-left hover:underline"
                  >
                    <span className="font-medium">
                      {p.last_name} {p.first_name}
                    </span>
                    <span className="ml-2 text-muted-foreground">{p.court ?? "—"}</span>
                  </button>
                  <span className="w-40 shrink-0 truncate text-muted-foreground">
                    {institutionLabel(p.institution)}
                  </span>
                  <span className="w-28 shrink-0 tabular-nums">
                    {dataPlanului(p)}
                  </span>
                  <span className="flex w-56 shrink-0 items-center justify-end gap-1">
                    {/* Numai la cei fără zi de transfer: doar pentru ei se
                        trimite hârtia. Bifa arată situația de ACUM — după o
                        amânare care lasă iar ziua imposibilă, butonul se
                        întoarce, fiindcă e altă înștiințare de trimis. */}
                    {imposibil &&
                      (esteInstiintat(p) ? (
                        <button
                          type="button"
                          onClick={() => setInstiintat(p, false)}
                          title="Scoate bifa înștiințării"
                          className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 transition-colors hover:bg-emerald-200"
                        >
                          <MailCheck className="h-3 w-3" aria-hidden />
                          Înștiințată{" "}
                          {format(new Date(p.notified_at!), "d MMM", { locale: ro })}
                        </button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 border-amber-300 px-2 text-xs text-amber-900 hover:bg-amber-100"
                          onClick={() => setInstiintat(p, true)}
                        >
                          <MailCheck className="mr-1 h-3.5 w-3.5" /> Înștiințare expediată
                        </Button>
                      ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setDone(p, true)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Încheiat
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/*
        Încheiatele rămân la vedere, pliate, cu drum înapoi. „Încheiat" e un
        singur click pe fiecare rând; înainte, persoana dispărea din registru
        fără nicio cale de întoarcere în afară de SQL — într-un registru care
        există tocmai ca nimeni să nu fie scăpat din vedere. Jurnalul de audit
        știa deja să povestească redeschiderea; acum are și cine s-o facă.
      */}
      {incheiate.length > 0 && (
        <details className="rounded-xl border bg-card">
          <summary className="cursor-pointer select-none px-3.5 py-2 text-[13px] text-muted-foreground">
            Încheiate ({incheiate.length})
          </summary>
          <div className="divide-y border-t">
            {incheiate.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3.5 py-2 text-[13px] text-muted-foreground"
              >
                <span className="min-w-0 flex-1 truncate">
                  {p.last_name} {p.first_name}
                  <span className="ml-2">{p.court ?? "—"}</span>
                </span>
                <span className="w-28 shrink-0 tabular-nums">
                  {dataPlanului(p)}
                </span>
                <span className="flex w-28 shrink-0 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setDone(p, false)}
                  >
                    <Undo2 className="mr-1 h-3.5 w-3.5" /> Redeschide
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <PlanDialog open={open} onOpenChange={setOpen} plan={editing} isAdmin={isAdmin} />
    </div>
  );
}
