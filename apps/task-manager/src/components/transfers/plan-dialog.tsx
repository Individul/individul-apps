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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deletePlan, savePlan } from "@/app/transferuri/planificare/actions";
import { COURTS } from "@/lib/courts";
import { INSTITUTIONS, institutionLabel } from "@/lib/transfers";
import { transferDayFor, type TransferPlan } from "@/lib/transfer-plans";
import { parseISODate } from "@/lib/periods";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: TransferPlan | null;
  isAdmin: boolean;
}

export function PlanDialog({ open, onOpenChange, plan, isAdmin }: PlanDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [court, setCourt] = useState<string>("");
  const [institution, setInstitution] = useState("");
  const [hearingDate, setHearingDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLastName(plan?.last_name ?? "");
    setFirstName(plan?.first_name ?? "");
    setCourt(plan?.court ?? "");
    setInstitution(plan ? String(plan.institution) : "");
    setHearingDate(plan?.hearing_date ?? "");
    setNote(plan?.note ?? "");
  }, [open, plan]);

  // Ziua de transfer se arată în timp ce completezi: dacă nu mai există una,
  // afli înainte de a salva, nu după.
  const day = hearingDate ? transferDayFor(parseISODate(hearingDate)) : null;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await savePlan(plan?.id ?? null, {
        last_name: lastName,
        first_name: firstName,
        court,
        institution,
        hearing_date: hearingDate,
        note,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(plan ? "Însemnare salvată." : "Însemnare adăugată.");
      onOpenChange(false);
      router.refresh();
    });
  };

  const remove = () => {
    if (!plan) return;
    if (!window.confirm("Ștergi această însemnare?")) return;
    startTransition(async () => {
      const res = await deletePlan(plan.id);
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
          <DialogTitle>{plan ? "Editează însemnarea" : "Persoană nouă"}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="p-last">Nume</Label>
              <Input
                id="p-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-first">Prenume</Label>
              <Input
                id="p-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Instanța</Label>
            <Select value={court} onValueChange={setCourt}>
              <SelectTrigger>
                <SelectValue placeholder="Alege instanța" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COURTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Penitenciarul unde trebuie dus</Label>
              <Select value={institution} onValueChange={setInstitution}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege penitenciarul" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {INSTITUTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {institutionLabel(n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-hearing">Data ședinței</Label>
              <Input
                id="p-hearing"
                type="date"
                value={hearingDate}
                onChange={(e) => setHearingDate(e.target.value)}
                required
              />
              {hearingDate && (
                <p className="text-xs text-muted-foreground">
                  {day ? (
                    <>
                      Transfer pe{" "}
                      <span className="font-medium text-foreground">
                        {format(parseISODate(day), "d MMMM yyyy", { locale: ro })}
                      </span>
                    </>
                  ) : (
                    <span className="text-amber-700">
                      Nu mai există zi de transfer înainte de ședință — de înștiințat instanța.
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-note">Observații</Label>
            <Textarea
              id="p-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opțional"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {plan && isAdmin && (
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
                {plan ? "Salvează" : "Adaugă"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
