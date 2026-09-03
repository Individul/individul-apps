"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scadeArest, sfarsitTermen, termenText, type Termen } from "@/lib/penal/termene";

/**
 * Calculatorul de sfârșit de termen.
 *
 * Fereastră, nu panou lateral: e o socoteală pe care o faci intenționat și apoi
 * o închizi. Un calculator gol care stă permanent pe margine devine tapet, iar
 * pe ecranele secției (1366–1440) nici n-ar fi avut loc.
 */
export function TermDialog() {
  const [open, setOpen] = useState(false);
  const [inceput, setInceput] = useState("");
  const [ani, setAni] = useState("");
  const [luni, setLuni] = useState("");
  const [zile, setZile] = useState("");
  const [arest, setArest] = useState("");

  const n = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  };

  const termen: Termen = { ani: n(ani), luni: n(luni), zile: n(zile) };
  const areTermen = termen.ani + termen.luni + termen.zile > 0;
  const zileArest = n(arest);

  const start = inceput ? new Date(`${inceput}T12:00:00`) : null;
  const valid = start && !Number.isNaN(start.getTime()) && areTermen;

  const sfarsit = valid ? sfarsitTermen(start, termen) : null;
  const cuArest = sfarsit ? scadeArest(sfarsit, zileArest) : null;

  const dataRo = (d: Date) => format(d, "d MMMM yyyy", { locale: ro });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarClock className="mr-2 h-4 w-4" />
          Calculator termen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sfârșitul termenului</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-inceput">Data începerii executării</Label>
            <Input
              id="t-inceput"
              type="date"
              value={inceput}
              onChange={(e) => setInceput(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Pedeapsa</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: ani, set: setAni, eticheta: "Ani" },
                { v: luni, set: setLuni, eticheta: "Luni" },
                { v: zile, set: setZile, eticheta: "Zile" },
              ].map((c) => (
                <div key={c.eticheta} className="space-y-1">
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={c.v}
                    onChange={(e) => c.set(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">{c.eticheta}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-arest">Zile de arest preventiv (opțional)</Label>
            <Input
              id="t-arest"
              type="number"
              min={0}
              inputMode="numeric"
              value={arest}
              onChange={(e) => setArest(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Rezultatul apare abia când are din ce ieși: un „—" permanent ar
              părea un răspuns, nu o așteptare. */}
          {valid && sfarsit && cuArest && (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Pedeapsa de {termenText(termen)}, din {dataRo(start)}
                </p>
                <p className="mt-1 text-lg font-semibold">{dataRo(sfarsit)}</p>
                <p className="text-xs text-muted-foreground">
                  sfârșitul termenului, fără arest preventiv
                </p>
              </div>

              {zileArest > 0 && (
                <div className="border-t pt-3">
                  <p className="text-lg font-semibold">{dataRo(cuArest)}</p>
                  <p className="text-xs text-muted-foreground">
                    cu {zileArest} {zileArest === 1 ? "zi" : "zile"} de arest preventiv scăzute
                  </p>
                </div>
              )}

              {/* Regula nu e evidentă, iar cine verifică socoteala pe hârtie
                  trebuie să știe de ce data e cu o zi mai devreme. */}
              <p className="border-t pt-3 text-xs text-muted-foreground">
                Termenii în ani și luni expiră în ziua precedentă zilei
                corespunzătoare. Rezultatul e orientativ.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
