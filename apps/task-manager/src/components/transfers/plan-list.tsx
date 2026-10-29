"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { AlertTriangle, Check, MailCheck, Plus, Printer, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlanDialog } from "@/components/transfers/plan-dialog";
import { dataPlanului, ziuaTransferului } from "@/components/transfers/plan-format";
import { PlanPrint } from "@/components/transfers/plan-print";
import { setPlanDone, setPlanNotified } from "@/app/transferuri/planificare/actions";
import {
  esteInstiintat,
  groupByTransferDay,
  matchesPlan,
  termenDepasit,
  termenLimita,
  type TransferPlan,
} from "@/lib/transfer-plans";
import { institutionLabel } from "@/lib/transfers";
import { parseISODate } from "@/lib/periods";

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
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  /**
   * Ce se tipărește: `undefined` = tot ce se vede acum, altfel ziua unui grup
   * (`null` e grupul fără zi de transfer). Se alege din butonul grupului, se
   * tipărește, iar după tipărire revine la tot. Ctrl+P tipărește tot, fiindcă
   * starea de bază e „tot".
   */
  const [ziTiparita, setZiTiparita] = useState<string | null | undefined>(undefined);
  const [deTiparit, setDeTiparit] = useState(false);

  useEffect(() => {
    if (!deTiparit) return;
    // Efectul rulează după ce React a scris lista aleasă în pagină, iar tiparul
    // își face singur așezarea din DOM; `setTimeout`, nu `requestAnimationFrame`,
    // fiindcă acela nu pornește într-o filă ascunsă.
    const id = setTimeout(() => {
      window.print();
      setDeTiparit(false);
      setZiTiparita(undefined);
    }, 0);
    return () => clearTimeout(id);
  }, [deTiparit]);

  const tipareste = (zi: string | null | undefined) => {
    setZiTiparita(zi);
    setDeTiparit(true);
  };

  const cautare = search.trim() !== "";
  // Căutarea se aplică înainte de grupare, ca grupurile fără niciun rând
  // potrivit să dispară cu totul, nu să rămână cu antetul și un corp gol.
  const vizibile = plans.filter((p) => matchesPlan(p, search));
  const groups = groupByTransferDay(vizibile);
  const totalDeTransferat = plans.filter((p) => !p.done).length;
  const gasiteDeTransferat = vizibile.filter((p) => !p.done).length;
  /*
   * Câte înștiințări mai sunt de trimis, socotite pe TOT grupul, nu doar pe ce
   * a rămas după căutare. Altfel, căutând pe cineva deja înștiințat, antetul
   * ar fi trecut pe verde — „Instanțele au fost înștiințate" — deși alții din
   * același grup încă așteaptă hârtia.
   */
  const deTrimisTotal = groupByTransferDay(plans)
    .filter((g) => g.day === null)
    .reduce((n, g) => n + g.plans.filter((p) => !esteInstiintat(p)).length, 0);
  // Cele mai noi primele: cine caută un „Încheiat" apăsat din greșeală îl
  // caută pe cel de adineauri, nu pe cel de acum trei luni.
  const incheiate = vizibile
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

  const grupeTiparite = ziTiparita === undefined ? groups : groups.filter((g) => g.day === ziTiparita);
  const selectieTiparita = [
    ziTiparita !== undefined
      ? ziTiparita === null
        ? "Doar persoanele fără zi de transfer înainte de ședință"
        : `Doar transferul din ${ziuaTransferului(ziTiparita)}`
      : null,
    cautare ? `Selecție după căutarea „${search.trim()}”` : null,
  ]
    .filter(Boolean)
    .join(" · ") || null;

  return (
    <div className="space-y-4">
      <PlanPrint groups={grupeTiparite} selectie={selectieTiparita} />
      {/* Tot ce urmează e lista de lucru, cu butoane: pe hârtie iese PlanPrint. */}
      <div className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută după nume, instanță sau penitenciar…"
          aria-label="Caută în planificare"
          className="h-8 max-w-xs"
        />
        {/* Cu o căutare activă se spune și din câți, altfel „2" ar putea fi
            citit drept toți cei de transferat. */}
        <p className="text-sm text-muted-foreground">
          {cautare
            ? `${gasiteDeTransferat} din ${totalDeTransferat} de transferat`
            : totalDeTransferat === 0
              ? "Nicio persoană în așteptare."
              : `${totalDeTransferat} persoane de transferat`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-7"
          disabled={groups.length === 0}
          title={cautare ? "Tipărește persoanele găsite" : "Tipărește lista celor preconizați pentru transfer"}
          onClick={() => tipareste(undefined)}
        >
          <Printer className="mr-1 h-3.5 w-3.5" /> Tipărește
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7"
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
          {/* „Temeiul și data", nu „Data ședinței": rândul poate arăta o
              ședință, o decizie sau o încheiere, iar data spune care. Lată cât
              să încapă „încheiere, 10 sep 2026" pe un rând. */}
          <span className="w-36 shrink-0">Temeiul și data</span>
          {/* Lățime egală în antet și în rânduri, deși în grupurile obișnuite
              rămâne mai goală: la „de înștiințat" mai încape un buton, iar dacă
              lățimea ar diferi de la un grup la altul, coloanele fixe dinaintea
              ei s-ar deplasa doar acolo. */}
          <span className="w-56 shrink-0" aria-hidden />
        </div>
      )}

      {cautare && groups.length === 0 && incheiate.length === 0 && (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-muted-foreground">
          Niciun nume nu se potrivește cu „{search.trim()}”.
        </div>
      )}

      {groups.map((group) => {
        const imposibil = group.day === null;
        // Câți din grup mai așteaptă hârtia. Antetul care ar spune mai departe
        // „De înștiințat instanța" după ce toate au plecat ar cere o muncă
        // deja făcută — iar cine îl citește de la distanță ar crede că a rămas
        // ceva de trimis.
        const deTrimis = imposibil
          ? cautare
            ? deTrimisTotal
            : group.plans.filter((p) => !esteInstiintat(p)).length
          : 0;
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
                <span className="font-medium">Transfer pe {ziuaTransferului(group.day!)}</span>
              )}
              <span className="ml-auto tabular-nums text-muted-foreground">
                {group.plans.length}
              </span>
              <button
                type="button"
                onClick={() => tipareste(group.day)}
                title="Tipărește doar această zi"
                aria-label={imposibil ? "Tipărește persoanele fără zi de transfer" : `Tipărește transferul din ${ziuaTransferului(group.day!)}`}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
              </button>
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
                  <span className="w-36 shrink-0 tabular-nums">
                    {dataPlanului(p)}
                  </span>
                  <span className="flex w-56 shrink-0 items-center justify-end gap-1">
                    {/* Termenul celor 30 de zile, lângă butoane: e singurul temei
                        cu o zi-limită de după transfer, deci n-are coloana lui —
                        o coloană goală la toate celelalte rânduri ar fi împins
                        tabelul pentru un singur fel de însemnare. Roșu când omul
                        nu mai apucă să plece în termen. */}
                    {p.basis === "termen30" && termenLimita(p) && (
                      termenDepasit(p) ? (
                        <span
                          className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800"
                          title={`Termenul de 30 de zile s-a încheiat pe ${format(parseISODate(termenLimita(p)!), "d MMMM yyyy", { locale: ro })}`}
                        >
                          termen depășit
                        </span>
                      ) : (
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          termen {format(parseISODate(termenLimita(p)!), "d MMM", { locale: ro })}
                        </span>
                      )
                    )}
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
        // Deschise singure cât timp se caută: cine caută un nume vrea să-l vadă
        // oriunde ar fi, nu să afle după un clic că era printre încheiate.
        // `key` le remontează doar când pornește sau se oprește căutarea, ca un
        // pliu deschis de mână să nu se închidă la fiecare tastă.
        <details
          key={cautare ? "cautare" : "lista"}
          open={cautare || undefined}
          className="rounded-xl border bg-card"
        >
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
                <span className="w-36 shrink-0 tabular-nums">
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
    </div>
  );
}
