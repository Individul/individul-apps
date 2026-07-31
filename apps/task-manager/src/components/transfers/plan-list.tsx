"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { AlertTriangle, Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PlanDialog } from "@/components/transfers/plan-dialog";
import { setPlanDone } from "@/app/transferuri/planificare/actions";
import { groupByTransferDay, type TransferPlan } from "@/lib/transfer-plans";
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
  const [, startTransition] = useTransition();

  const groups = groupByTransferDay(plans);
  const incheiate = plans.filter((p) => p.done).length;

  const markDone = (plan: TransferPlan) => {
    startTransition(async () => {
      const res = await setPlanDone(plan.id, true);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${plan.last_name} ${plan.first_name} — încheiat.`);
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
          {incheiate > 0 && ` · ${incheiate} încheiate`}
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
          <span className="w-24 shrink-0" aria-hidden />
        </div>
      )}

      {groups.map((group) => {
        const imposibil = group.day === null;
        return (
          <section
            key={group.day ?? "imposibil"}
            className={cn(
              "overflow-hidden rounded-xl border bg-card",
              imposibil && "border-amber-300",
            )}
          >
            <header
              className={cn(
                "flex items-center gap-2 border-b px-3.5 py-2 text-[13px]",
                imposibil ? "bg-amber-50 text-amber-900" : "bg-muted/30",
              )}
            >
              {imposibil ? (
                <>
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="font-medium">
                    De înștiințat instanța — nu mai există zi de transfer înainte de ședință
                  </span>
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
                    <span className="ml-2 text-muted-foreground">{p.court}</span>
                  </button>
                  <span className="w-40 shrink-0 truncate text-muted-foreground">
                    {institutionLabel(p.institution)}
                  </span>
                  <span className="w-28 shrink-0 tabular-nums">
                    {format(parseISODate(p.hearing_date), "d MMM yyyy", { locale: ro })}
                  </span>
                  <span className="flex w-24 shrink-0 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => markDone(p)}
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

      <PlanDialog open={open} onOpenChange={setOpen} plan={editing} isAdmin={isAdmin} />
    </div>
  );
}
