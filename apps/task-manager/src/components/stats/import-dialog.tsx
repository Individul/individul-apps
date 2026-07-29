"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { previewImport, saveImport, type StatPreview } from "@/app/statistici/actions";
import type { PeriodType } from "@/lib/stats/period";
import { PERIOD_TYPE_LABEL, SERIES_LABEL } from "@/lib/stats/labels";

const PERIOD_OPTIONS: PeriodType[] = ["lunar", "saptamanal"];

/** Fișierul în base64, așa cum îl așteaptă `saveImport` (prefixul `data:` e acceptat). */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Nu am putut citi fișierul de pe disc."));
    reader.readAsDataURL(file);
  });
}

export function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Fișierul ales rămâne în stare: previzualizarea l-a citit pe server, dar
  // salvarea are nevoie de octeții lui ca să urce sursa.
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StatPreview | null>(null);
  const [periodDate, setPeriodDate] = useState("");
  const [periodType, setPeriodType] = useState<PeriodType>("lunar");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setPeriodDate("");
    setPeriodType("lunar");
    setPending(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    // Cât timp rulează o operațiune, dialogul nu se închide sub mâna omului.
    if (pending) return;
    setOpen(next);
    if (!next) reset();
  };

  const handlePick = async (input: HTMLInputElement) => {
    const picked = input.files?.[0];
    // Resetăm imediat, ca același fișier să poată fi ales din nou după o eroare.
    input.value = "";
    if (!picked) return;

    setPending(true);
    setPreview(null);
    setFile(picked);
    try {
      const data = new FormData();
      data.append("file", picked);
      const res = await previewImport(data);
      // Uniune discriminată: eroarea și raportul citit nu se pot confunda.
      if ("error" in res) {
        toast.error(res.error);
        setFile(null);
        return;
      }
      setPreview(res);
      setPeriodDate(res.suggested?.date ?? "");
      setPeriodType(res.suggested?.type ?? "lunar");
    } catch {
      toast.error("Nu am putut citi fișierul.");
      setFile(null);
    } finally {
      setPending(false);
    }
  };

  const handleSave = async () => {
    if (!preview || !file || !periodDate) return;
    setPending(true);
    try {
      const fileBase64 = await readAsBase64(file);
      const res = await saveImport({
        // Tipul e cel detectat, nu unul ales de om: indicatorii de mai jos vin
        // de la parserul lui, iar salvarea lor sub alt tip ar amesteca seriile.
        kind: preview.kind,
        periodDate,
        periodType,
        fileName: preview.fileName,
        fileBase64,
        items: preview.items,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Raport importat");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Importul a eșuat.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" aria-hidden />
        Importă raport
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importă raport</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="stat-file">Fișier .xlsx</Label>
              <Input
                id="stat-file"
                ref={inputRef}
                type="file"
                accept=".xlsx"
                disabled={pending}
                className="cursor-pointer file:mr-3 file:cursor-pointer file:text-foreground"
                onChange={(e) => {
                  void handlePick(e.currentTarget);
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Tipul raportului se recunoaște singur din conținutul fișierului.
              </p>
            </div>

            {pending && !preview && (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Se citește fișierul…
              </p>
            )}

            {preview && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/*
                   * Tipul rămâne doar de citit. Indicatorii de mai jos au fost
                   * extrași de parserul detectat, iar `previewImport` nu poate
                   * primi alt parser — un selector care schimbă doar eticheta ar
                   * salva datele unui raport sub numele altuia.
                   */}
                  <div className="space-y-1.5">
                    <Label>Tip raport</Label>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                      {preview.kindLabel}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Detectat automat ({Math.round(preview.score * 100)}% potrivire)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stat-period-type">Tip perioadă</Label>
                    <Select
                      value={periodType}
                      onValueChange={(v) => setPeriodType(v as PeriodType)}
                      disabled={pending}
                    >
                      <SelectTrigger id="stat-period-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIOD_OPTIONS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {PERIOD_TYPE_LABEL[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stat-period-date">Perioada</Label>
                    <Input
                      id="stat-period-date"
                      type="date"
                      value={periodDate}
                      disabled={pending}
                      onChange={(e) => setPeriodDate(e.target.value)}
                    />
                    {!periodDate && (
                      <p className="text-[11px] text-muted-foreground">
                        Nu am ghicit perioada din numele fișierului — alege-o.
                      </p>
                    )}
                  </div>
                </div>

                {preview.existing && (
                  <p className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-[13px] text-yellow-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    Există deja un raport pentru această perioadă — va fi înlocuit.
                  </p>
                )}

                <div className="space-y-1.5">
                  <p className="text-[13px] text-muted-foreground">
                    {preview.items.length} indicatori
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-xl border bg-card">
                    <table className="w-full text-[13px]">
                      <thead className="sticky top-0 bg-muted/30 text-[11px] font-medium text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Indicator</th>
                          <th className="w-24 px-3 py-2 text-left font-medium">Serie</th>
                          <th className="w-28 px-3 py-2 text-right font-medium">Valoare</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.items.map((item, i) => (
                          <tr key={`${item.series}-${item.indicator}-${i}`}>
                            <td className="px-3 py-1.5">{item.indicator}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {SERIES_LABEL[item.series]}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {item.value === null ? "—" : item.value.toLocaleString("ro-RO")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
            >
              Renunță
            </Button>
            <Button
              type="button"
              disabled={pending || !preview || !periodDate}
              onClick={() => {
                void handleSave();
              }}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Importă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
