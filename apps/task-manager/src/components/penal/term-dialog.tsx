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
import {
  scadeArest,
  scadeTermen,
  sfarsitTermen,
  termenText,
  zileIntre,
  type Termen,
} from "@/lib/penal/termene";
import { cn } from "@/lib/utils";

/**
 * Calculatorul de termen, cu două unelte independente.
 *
 * Ele răspund la două întrebări deosebite, iar cine o are pe a doua rareori are
 * și datele primeia: sfârșitul e deja în dosar, iar încheierea de reducere
 * tocmai a venit. Înlănțuite — reducerea aplicată doar rezultatului de sus —
 * omul ar fi trebuit să reconstituie începutul și pedeapsa ca să scadă zece
 * zile. De aceea se aleg, nu se parcurg.
 *
 * Fereastră, nu panou lateral: e o socoteală pe care o faci intenționat și apoi
 * o închizi.
 */

type Unealta = "din-inceput" | "din-sfarsit";

const UNELTE: { value: Unealta; label: string }[] = [
  { value: "din-inceput", label: "Din data începerii" },
  { value: "din-sfarsit", label: "Reducere de termen" },
];

/** Trei câmpuri de durată, folosite de amândouă uneltele. */
function CampuriTermen({
  valori,
  seteaza,
}: {
  valori: [string, string, string];
  seteaza: [(v: string) => void, (v: string) => void, (v: string) => void];
}) {
  const etichete = ["Ani", "Luni", "Zile"];
  return (
    <div className="grid grid-cols-3 gap-3">
      {etichete.map((eticheta, i) => (
        <div key={eticheta} className="space-y-1">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={valori[i]}
            onChange={(e) => seteaza[i](e.target.value)}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">{eticheta}</p>
        </div>
      ))}
    </div>
  );
}

function Rezultat({
  context,
  data,
  explicatie,
}: {
  context: string;
  data: Date;
  explicatie: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <p className="text-xs text-muted-foreground">{context}</p>
      <p className="mt-1 text-lg font-semibold">
        {format(data, "d MMMM yyyy", { locale: ro })}
      </p>
      <p className="text-xs text-muted-foreground">{explicatie}</p>
    </div>
  );
}

export function TermDialog() {
  const [open, setOpen] = useState(false);
  const [unealta, setUnealta] = useState<Unealta>("din-inceput");

  // Unealta 1
  const [inceput, setInceput] = useState("");
  const [ani, setAni] = useState("");
  const [luni, setLuni] = useState("");
  const [zile, setZile] = useState("");
  const [arestActiv, setArestActiv] = useState(false);
  const [arestDeLa, setArestDeLa] = useState("");
  const [arestPanaLa, setArestPanaLa] = useState("");

  // Unealta 2
  const [sfarsitCunoscut, setSfarsitCunoscut] = useState("");
  const [redAni, setRedAni] = useState("");
  const [redLuni, setRedLuni] = useState("");
  const [redZile, setRedZile] = useState("");

  const n = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  };
  const data = (s: string) => {
    if (!s) return null;
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const dataRo = (d: Date) => format(d, "d MMMM yyyy", { locale: ro });

  // ── Unealta 1: din data începerii ────────────────────────────────────────
  const termen: Termen = { ani: n(ani), luni: n(luni), zile: n(zile) };
  const areTermen = termen.ani + termen.luni + termen.zile > 0;

  const aDeLa = data(arestDeLa);
  const aPanaLa = data(arestPanaLa);
  const arestGresit = Boolean(arestActiv && aDeLa && aPanaLa && aPanaLa <= aDeLa);
  const zileArest =
    arestActiv && aDeLa && aPanaLa && !arestGresit ? zileIntre(aDeLa, aPanaLa) : 0;

  const start = data(inceput);
  const valid1 = start !== null && areTermen && !arestGresit;
  const sfarsit = valid1 ? sfarsitTermen(start, termen) : null;
  const cuArest = sfarsit ? scadeArest(sfarsit, zileArest) : null;

  // ── Unealta 2: din sfârșitul cunoscut ────────────────────────────────────
  const baza = data(sfarsitCunoscut);
  const reducere: Termen = { ani: n(redAni), luni: n(redLuni), zile: n(redZile) };
  const areReducere = reducere.ani + reducere.luni + reducere.zile > 0;
  const dupaReducere = baza && areReducere ? scadeTermen(baza, reducere) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarClock className="mr-2 h-4 w-4" />
          Calculator termen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Calculator termen</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          {UNELTE.map((u) => (
            <button
              key={u.value}
              type="button"
              onClick={() => setUnealta(u.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                u.value === unealta
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {u.label}
            </button>
          ))}
        </div>

        {unealta === "din-inceput" ? (
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
              <CampuriTermen valori={[ani, luni, zile]} seteaza={[setAni, setLuni, setZile]} />
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

            {valid1 && start && sfarsit && cuArest && (
              <div className="space-y-3">
                <Rezultat
                  context={`Pedeapsa de ${termenText(termen)}, din ${dataRo(start)}`}
                  data={sfarsit}
                  explicatie="sfârșitul termenului, fără arest preventiv"
                />
                {zileArest > 0 && (
                  <Rezultat
                    context={`Cu ${zileArest} ${zileArest === 1 ? "zi" : "zile"} de arest preventiv scăzute`}
                    data={cuArest}
                    explicatie="sfârșitul termenului"
                  />
                )}
                {/* Se trece dintr-o unealtă în alta ducând rezultatul cu tine:
                    e drumul firesc când tocmai a venit o încheiere. */}
                <button
                  type="button"
                  onClick={() => {
                    setSfarsitCunoscut(format(cuArest, "yyyy-MM-dd"));
                    setUnealta("din-sfarsit");
                  }}
                  className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  Aplică o reducere pe această dată →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="t-sfarsit">Sfârșitul termenului, cunoscut</Label>
              <Input
                id="t-sfarsit"
                type="date"
                value={sfarsitCunoscut}
                onChange={(e) => setSfarsitCunoscut(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cel din dosar. Nu e nevoie de data începerii și de pedeapsă.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reducerea dispusă prin încheiere</Label>
              <CampuriTermen
                valori={[redAni, redLuni, redZile]}
                seteaza={[setRedAni, setRedLuni, setRedZile]}
              />
            </div>

            {dupaReducere && baza && (
              <Rezultat
                context={`${dataRo(baza)}, redus cu ${termenText(reducere)}`}
                data={dupaReducere}
                explicatie="sfârșitul termenului după reducere"
              />
            )}
          </div>
        )}

        {/* Nota stă jos, sub amândouă: regula e aceeași oriunde se socotește. */}
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Termenii exprimați numai în ani expiră în ziua precedentă zilei
          corespunzătoare; la luni și zile, chiar în ziua corespunzătoare.
          Rezultatul e orientativ.
        </p>
      </DialogContent>
    </Dialog>
  );
}
