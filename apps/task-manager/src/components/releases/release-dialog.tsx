"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteReleasePlan, saveReleasePlan } from "@/app/eliberari/actions";
import { groupedGroundOptions, type ReleasePlan } from "@/lib/releases";

interface ReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ReleasePlan | null;
  isAdmin: boolean;
}

export function ReleaseDialog({ open, onOpenChange, plan, isAdmin }: ReleaseDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [ground, setGround] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLastName(plan?.last_name ?? "");
    setFirstName(plan?.first_name ?? "");
    setReleaseDate(plan?.release_date ?? "");
    setGround(plan?.ground ?? "");
    setNote(plan?.note ?? "");
  }, [open, plan]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveReleasePlan({
        id: plan?.id ?? null,
        last_name: lastName,
        first_name: firstName,
        release_date: releaseDate,
        ground,
        note,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(plan ? "Eliberare salvată." : "Eliberare adăugată.");
      onOpenChange(false);
      router.refresh();
    });
  };

  const remove = () => {
    if (!plan) return;
    if (!window.confirm("Ștergi această eliberare din listă?")) return;
    startTransition(async () => {
      const res = await deleteReleasePlan(plan.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Eliberare ștearsă.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? "Editează eliberarea" : "Eliberare nouă"}</DialogTitle>
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
              <Label htmlFor="e-last">Nume</Label>
              <Input
                id="e-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-first">Prenume</Label>
              <Input
                id="e-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Rândul ăsta se desface pe telefon, spre deosebire de cel de sus:
              „Mecanism compensatoriu" într-o jumătate de ecran îngust ajunge
              „Art. 91…", iar temeiul ales devine o ghicitoare. Numele încap
              alături fiindcă un câmp text prea strâmt se derulează, nu-și
              ascunde valoarea. */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-date">Data eliberării</Label>
              <Input
                id="e-date"
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Temeiul</Label>
              {/* Grupat pe condamnați și preveniți, nu nouăsprezece rânduri la
                  rând: temeiurile celor două categorii nu se amestecă niciodată
                  în capul omului care completează, iar o listă plată l-ar pune
                  să le despartă singur de fiecare dată. Grupele vin din
                  `groupedGroundOptions()`, deci nu pot rămâne în urma hărții. */}
              <Select value={ground} onValueChange={setGround}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege temeiul" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {groupedGroundOptions().map((grup) => (
                    <SelectGroup key={grup.category}>
                      <SelectLabel>{grup.label}</SelectLabel>
                      {grup.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="e-note">Observații</Label>
            <Textarea
              id="e-note"
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
