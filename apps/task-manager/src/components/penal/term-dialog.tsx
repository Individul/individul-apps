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
import { scadeArest, sfarsitTermen, termenText, zileIntre, type Termen } from "@/lib/penal/termene";

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
  const [arestActiv, setArestActiv] = useState(false);
  const [arestDeLa, setArestDeLa] = useState("");
  const [arestPanaLa, setArestPanaLa] = useState("");

  const n = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  };

  const termen: Termen = { ani: n(ani), luni: n(luni), zile: n(zile) };
  const areTermen = termen.ani + termen.luni + termen.zile > 0;

  const data = (s: string) => {
    if (!s) return null;
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  /*
   * Arestul se dă ca două date, nu ca un număr de zile.
   *
   * Așa e scris și în dosar, iar regula de numărare nu e cea la care se
   * gândește omul: `[start, end)` include ziua de început și o exclude pe cea
   * de sfârșit. Cerut ca număr, fiecare l-ar fi socotit pe hârtie altfel, iar o
   * zi în plus la arest e o zi în minus la pedeapsă.
   */
  const aDeLa = data(arestDeLa);
  const aPanaLa = data(arestPanaLa);
  const arestGresit = Boolean(arestActiv && aDeLa && aPanaLa && aPanaLa <= aDeLa);
  const zileArest =
    arestActiv && aDeLa && aPanaLa && !arestGresit ? zileIntre(aDeLa, aPanaLa) : 0;

  const start = data(inceput);
  const valid = start !== null && areTermen && !arestGresit;

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

          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={arestActiv}
                onChange={(e) => setArestActiv(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="font-medium">Arest preventiv</span>
            </label>

            {arestActiv && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Input
                      type="date"
                      value={arestDeLa}
                      onChange={(e) => setArestDeLa(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">De la</p>
                  </div>
                  <div className="space-y-1">
                    <Input
                      type="date"
                      value={arestPanaLa}
                      onChange={(e) => setArestPanaLa(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Până la</p>
                  </div>
                </div>
                {arestGresit ? (
                  <p className="text-xs text-destructive">
                    Data de sfârșit trebuie să fie după cea de început.
                  </p>
                ) : (
                  zileArest > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {zileArest} {zileArest === 1 ? "zi" : "zile"} — ziua de început se
                      include, cea de sfârșit nu.
                    </p>
                  )
                )}
              </div>
            )}
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
