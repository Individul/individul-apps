"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPetition,
  updatePetition,
  deletePetition,
  type PetitionInput,
} from "@/app/petitii/actions";
import { PETITIONER_OPTIONS, STATUS_OPTIONS, deadlineFrom } from "./meta";
import { canEditPetition, canDeletePetition } from "@/lib/permissions";
import type { Petition, Profile, PetitionStatus, PetitionerType } from "@/lib/types";

const UNASSIGNED = "unassigned";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface PetitionFormDialogProps {
  profiles: Profile[];
  petition?: Petition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string | null;
  isAdmin: boolean;
}

export function PetitionFormDialog({
  profiles,
  petition,
  open,
  onOpenChange,
  currentUserId,
  isAdmin,
}: PetitionFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(petition);
  const [isPending, startTransition] = useTransition();

  const [numberField, setNumberField] = useState("");
  const [petitioner, setPetitioner] = useState("");
  const [petitionerType, setPetitionerType] = useState<PetitionerType>("detinut");
  const [subject, setSubject] = useState("");
  const [receivedDate, setReceivedDate] = useState(today());
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState<PetitionStatus>("in_examinare");
  const [response, setResponse] = useState("");
  const [responseDate, setResponseDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (petition) {
      setNumberField(petition.number);
      setPetitioner(petition.petitioner);
      setPetitionerType(petition.petitioner_type);
      setSubject(petition.subject ?? "");
      setReceivedDate(petition.received_date);
      setAssigneeId(petition.assignee_id ?? "");
      setStatus(petition.status);
      setResponse(petition.response ?? "");
      setResponseDate(petition.response_date ?? "");
    } else {
      setNumberField("");
      setPetitioner("");
      setPetitionerType("detinut");
      setSubject("");
      setReceivedDate(today());
      setAssigneeId("");
      setStatus("in_examinare");
      setResponse("");
      setResponseDate("");
    }
  }, [open, petition]);

  // O singură sursă de adevăr pentru drepturi (aceleași reguli ca RLS și ca meniul din listă).
  const uid = currentUserId ?? "";
  const canDelete = !!petition && canDeletePetition(uid, isAdmin, petition);
  // La creare oricine poate scrie; la editare doar cine are dreptul — altfel doar vizualizare.
  const readOnly = !!petition && !canEditPetition(uid, isAdmin, petition);
  const deadline = deadlineFrom(receivedDate);
  const yy = (receivedDate || today()).slice(2, 4);

  const buildInput = (): PetitionInput => ({
    petitioner,
    petitioner_type: petitionerType,
    subject,
    received_date: receivedDate,
    assignee_id: assigneeId,
    status,
    response,
    response_date: responseDate,
  });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = petition
        ? await updatePetition(petition.id, numberField, buildInput())
        : await createPetition(numberField, buildInput());
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(petition ? "Petiție salvată." : "Petiție înregistrată.");
      onOpenChange(false);
      router.refresh();
    });
  };

  const remove = () => {
    if (!petition) return;
    if (!window.confirm("Ștergi această petiție?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePetition(petition.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Petiție ștearsă.");
      onOpenChange(false);
      router.refresh();
    });
  };

  // La marcarea „Soluționat" prefill data răspunsului cu ziua curentă, dacă lipsește.
  const onStatusChange = (v: PetitionStatus) => {
    setStatus(v);
    if (v === "solutionat" && !responseDate) setResponseDate(today());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? "Petiția" : isEdit ? "Editează petiția" : "Petiție nouă"}
          </DialogTitle>
          {readOnly && (
            <p className="text-sm text-muted-foreground">
              Doar vizualizare — nu ai drept de editare pentru această petiție.
            </p>
          )}
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
              <Label htmlFor="p-number">Nr. de înregistrare</Label>
              <Input
                id="p-number"
                value={numberField}
                onChange={(e) => setNumberField(e.target.value)}
                disabled={readOnly}
                placeholder={isEdit ? "M-535/26" : "M-535"}
                required
              />
              {!isEdit && (
                <p className="text-xs text-muted-foreground">/{yy} se adaugă automat.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-received">Data înregistrării</Label>
              <Input
                id="p-received"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                disabled={readOnly}
                required
              />
              {deadline && (
                <p className="text-xs text-muted-foreground">
                  Termen (27 zile): {format(deadline, "d MMM yyyy")}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="p-petitioner">Petiționar</Label>
              <Input
                id="p-petitioner"
                value={petitioner}
                onChange={(e) => setPetitioner(e.target.value)}
                disabled={readOnly}
                placeholder="Nume, prenume"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tip petiționar</Label>
              <Select disabled={readOnly}
                value={petitionerType}
                onValueChange={(v) => setPetitionerType(v as PetitionerType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PETITIONER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-subject">Obiect</Label>
            <Textarea
              id="p-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={readOnly}
              placeholder="Obiectul petiției (opțional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Responsabil</Label>
              <Select disabled={readOnly}
                value={assigneeId ? assigneeId : UNASSIGNED}
                onValueChange={(v) => setAssigneeId(v === UNASSIGNED ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Neatribuit</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? "(fără nume)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stare</Label>
              <Select disabled={readOnly} value={status} onValueChange={(v) => onStatusChange(v as PetitionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="p-response-date">Data răspunsului</Label>
              <Input
                id="p-response-date"
                type="date"
                value={responseDate}
                onChange={(e) => setResponseDate(e.target.value)}
              disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-response">Răspuns</Label>
            <Textarea
              id="p-response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              disabled={readOnly}
              placeholder="Conținutul răspunsului (opțional)"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {canDelete && (
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
                {readOnly ? "Închide" : "Anulează"}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={isPending}>
                  {isEdit ? "Salvează" : "Înregistrează"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
