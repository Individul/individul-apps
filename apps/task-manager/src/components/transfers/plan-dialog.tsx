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
import {
  TERMEN_ZILE,
  transferDayFor,
  transferDayForDecision,
  type TransferBasis,
  type TransferPlan,
  ultimaZiDinTermen,
} from "@/lib/transfer-plans";
import { cn } from "@/lib/utils";
import { parseISODate, todayInChisinau, toISODate } from "@/lib/periods";

const TEMEIURI: { value: TransferBasis; label: string; regula: string }[] = [
  {
    value: "sedinta",
    label: "Ședință de judecată",
    regula: "Transferul se face în ultima zi programată dinaintea ședinței.",
  },
  {
    value: "decizie",
    label: "Decizie",
    regula: "Transferul se face la prima zi programată de la parvenirea deciziei.",
  },
  {
    value: "termen30",
    label: "30 zile",
    regula: `Transferul se face la prima zi programată. Termenul de ${TERMEN_ZILE} de zile curge din ziua în care introduceți încheierea.`,
  },
];

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
  const [basis, setBasis] = useState<TransferBasis>("sedinta");
  const [hearingDate, setHearingDate] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [rulingDate, setRulingDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLastName(plan?.last_name ?? "");
    setFirstName(plan?.first_name ?? "");
    setCourt(plan?.court ?? "");
    setInstitution(plan ? String(plan.institution) : "");
    setBasis(plan?.basis ?? "sedinta");
    setHearingDate(plan?.hearing_date ?? "");
    setDecisionDate(plan?.decision_date ?? "");
    setRulingDate(plan?.ruling_date ?? "");
    setNote(plan?.note ?? "");
  }, [open, plan]);

  // Ziua de transfer se arată în timp ce completezi: dacă nu mai există una,
  // afli înainte de a salva, nu după.
  /*
   * Ziua de transfer, arătată înainte de salvare.
   *
   * La decizie nu poate fi `null`: prima zi programată de după parvenire există
   * întotdeauna. Avertizarea „de înștiințat instanța" rămâne deci numai la
   * ședințe, unde chiar se poate să nu mai fie loc înaintea termenului.
   */
  const dataAleasa =
    basis === "decizie" ? decisionDate : basis === "termen30" ? rulingDate : hearingDate;
  const setDataAleasa =
    basis === "decizie" ? setDecisionDate : basis === "termen30" ? setRulingDate : setHearingDate;

  /*
   * La „30 zile", ziua de la care curge termenul nu se alege: e ziua
   * introducerii. O însemnare care era deja pe „30 zile" o are pe a ei; una
   * nouă sau mutată acum o primește pe cea de azi — exact ce face și acțiunea
   * la salvare, ca fereastra să nu promită altă zi decât se scrie.
   */
  const azi = toISODate(todayInChisinau());
  const termStart =
    basis === "termen30"
      ? plan?.basis === "termen30" && plan.term_start
        ? plan.term_start
        : azi
      : null;
  const limita = termStart ? ultimaZiDinTermen(termStart) : null;

  const day = !dataAleasa
    ? null
    : basis === "termen30"
      ? transferDayForDecision(parseISODate(termStart!))
      : basis === "decizie"
        ? transferDayForDecision(parseISODate(dataAleasa))
        : transferDayFor(parseISODate(dataAleasa));
  const depasit = Boolean(limita && day && day > limita);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await savePlan(plan?.id ?? null, {
        last_name: lastName,
        first_name: firstName,
        court,
        institution,
        basis,
        hearing_date: hearingDate,
        decision_date: decisionDate,
        ruling_date: rulingDate,
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

          {/*
            Temeiul stă înaintea datei, fiindcă el hotărăște ce înseamnă data:
            înaintea ședinței, sau de la parvenirea deciziei. Ales invers, omul
            ar scrie data cu un înțeles și ar salva-o cu altul.
          */}
          <div className="space-y-2">
            <Label>Temeiul transferului</Label>
            <div className="flex flex-wrap gap-2">
              {TEMEIURI.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setBasis(t.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    basis === t.value
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {TEMEIURI.find((t) => t.value === basis)?.regula}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Instanța{basis === "decizie" && " (opțional)"}</Label>
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
              <Label htmlFor="p-data">
                {basis === "decizie"
                  ? "Data parvenirii deciziei"
                  : basis === "termen30"
                    ? "Data încheierii"
                    : "Data ședinței"}
              </Label>
              <Input
                id="p-data"
                type="date"
                value={dataAleasa}
                max={basis === "termen30" ? azi : undefined}
                onChange={(e) => setDataAleasa(e.target.value)}
                required
              />
              {/* Termenul se vede înainte de salvare: de la ce zi curge și până
                  când, ca o însemnare întârziată să fie văzută acum, nu la
                  prima privire pe listă. */}
              {basis === "termen30" && termStart && limita && (
                <p className="text-xs text-muted-foreground">
                  Cele {TERMEN_ZILE} de zile curg de la{" "}
                  {format(parseISODate(termStart), "d MMMM yyyy", { locale: ro })}
                  {plan?.basis === "termen30" ? " (ziua introducerii)" : " (azi, ziua introducerii)"} —
                  până la{" "}
                  <span className="font-medium text-foreground">
                    {format(parseISODate(limita), "d MMMM yyyy", { locale: ro })}
                  </span>
                  .
                </p>
              )}
              {dataAleasa && (
                <p className="text-xs text-muted-foreground">
                  {depasit ? (
                    <span className="text-red-700">
                      Prima zi de transfer rămasă (
                      {format(parseISODate(day!), "d MMMM yyyy", { locale: ro })}) cade după
                      termen — termen depășit.
                    </span>
                  ) : day ? (
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
