"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteContravener, saveContravener } from "@/app/contravenienti/actions";
import { MAX_ARREST_DAYS, ultimaZiDeExecutare, type Contravener } from "@/lib/contraveners";
import { parseISODate } from "@/lib/periods";

interface ContravenerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contravener: Contravener | null;
  isAdmin: boolean;
  /** Ziua de azi pe ora Chișinăului, de la server — pentru executarea bifată acum. */
  azi: string;
}

export function ContravenerDialog({
  open,
  onOpenChange,
  contravener,
  isAdmin,
  azi,
}: ContravenerDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [finalDate, setFinalDate] = useState("");
  const [arrestDays, setArrestDays] = useState("");
  const [executed, setExecuted] = useState(false);
  const [executedOn, setExecutedOn] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLastName(contravener?.last_name ?? "");
    setFirstName(contravener?.first_name ?? "");
    setPatronymic(contravener?.patronymic ?? "");
    setDecisionDate(contravener?.decision_date ?? "");
    setFinalDate(contravener?.final_date ?? "");
    setArrestDays(contravener ? String(contravener.arrest_days) : "");
    setExecuted(Boolean(contravener?.executed_on));
    setExecutedOn(contravener?.executed_on ?? "");
  }, [open, contravener]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveContravener(contravener?.id ?? null, {
        last_name: lastName,
        first_name: firstName,
        patronymic,
        decision_date: decisionDate,
        final_date: finalDate,
        arrest_days: arrestDays,
        // Data urmează bifa: scoasă bifa, data nu mai are ce descrie, iar
        // păstrată ar stinge pe tăcute avertizarea de prescripție.
        executed_on: executed ? executedOn : "",
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(contravener ? "Însemnare salvată." : "Contravenient adăugat.");
      onOpenChange(false);
      router.refresh();
    });
  };

  const remove = () => {
    if (!contravener) return;
    if (!window.confirm("Ștergi această însemnare din registru?")) return;
    startTransition(async () => {
      const res = await deleteContravener(contravener.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Însemnare ștearsă.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contravener ? "Editează însemnarea" : "Contravenient nou"}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="c-last">Nume</Label>
              <Input
                id="c-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-first">Prenume</Label>
              <Input
                id="c-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-patronymic">Patronimic</Label>
              {/* Fără `required`: nu toți au patronimic, iar un câmp obligatoriu
                  i-ar lăsa pe aceia fără cale de a fi înscriși. */}
              <Input
                id="c-patronymic"
                value={patronymic}
                onChange={(e) => setPatronymic(e.target.value)}
                placeholder="Opțional"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-decision">Data hotărârii</Label>
              <Input
                id="c-decision"
                type="date"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-final">Data devenirii definitive</Label>
              {/* Opțională: hotărârea e știută înainte să fie definitivă, iar
                  omul trebuie înscris din ziua în care vine, nu din ziua în
                  care se află data. `min` oprește încă din calendar o zi de
                  dinaintea hotărârii — aceeași regulă ca în bază. */}
              <Input
                id="c-final"
                type="date"
                value={finalDate}
                min={decisionDate || undefined}
                onChange={(e) => setFinalDate(e.target.value)}
              />
              {/* Termenul se vede chiar în clipa în care se scrie data, nu
                  abia în listă: e momentul în care o dată greșită încă se
                  poate îndrepta. */}
              {finalDate && (
                <p className="text-xs text-muted-foreground">
                  Se poate pune în executare până la{" "}
                  {format(parseISODate(ultimaZiDeExecutare(finalDate)), "d MMMM yyyy", {
                    locale: ro,
                  })}{" "}
                  inclusiv.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 sm:w-1/2 sm:pr-2.5">
            <Label htmlFor="c-days">Zile arest contravențional</Label>
            <Input
              id="c-days"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_ARREST_DAYS}
              step={1}
              value={arrestDays}
              onChange={(e) => setArrestDays(e.target.value)}
              required
            />
          </div>

          {/*
            Executarea e ce stinge avertizarea de prescripție: pentru un arest
            executat termenul nu mai contează. Stă la vedere, ca măsura
            preventivă la inculpați, nu ascunsă — o bifă uitată ar lăsa un om
            care și-a ispășit zilele să apară peste un an drept „de informat".
          */}
          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={executed}
                onChange={(e) => {
                  setExecuted(e.target.checked);
                  // Bifat acum, cel mai des e executat azi; data rămâne de
                  // schimbat, dar nu de scris de la zero.
                  if (e.target.checked && !executedOn) setExecutedOn(azi);
                }}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="font-medium">Arestul a fost pus în executare</span>
            </label>

            {executed && (
              <div className="space-y-1.5 pl-6.5">
                <Label htmlFor="c-executed">Data</Label>
                <Input
                  id="c-executed"
                  type="date"
                  value={executedOn}
                  min={decisionDate || undefined}
                  max={azi}
                  onChange={(e) => setExecutedOn(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {contravener && isAdmin && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={remove}
                  disabled={isPending}
                >
                  Șterge
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Anulează
              </Button>
              <Button type="submit" disabled={isPending}>
                {contravener ? "Salvează" : "Adaugă"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
