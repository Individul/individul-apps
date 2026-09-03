"use client";

import { useMemo, useState } from "react";
import { Scale, X } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORII,
  CATEGORII_VARSTA,
  fractiuni,
  type CategorieVarsta,
} from "@/lib/penal/categorii";
import {
  alineatePentru,
  ceaMaiGrava,
  gasesteInfractiune,
  type Infractiune,
} from "@/lib/penal/clasificare";
import { cn } from "@/lib/utils";

/** Culorile categoriilor, urcând cu gravitatea — ca stările din căutare. */
const TON: Record<string, string> = {
  U: "bg-green-100 text-green-700",
  MPG: "bg-blue-100 text-blue-700",
  G: "bg-amber-100 text-amber-800",
  DG: "bg-orange-100 text-orange-800",
  EG: "bg-red-100 text-red-700",
};

/**
 * Clasificarea infracțiunii și fracțiile art. 91 / 92.
 *
 * Se adaugă mai multe infracțiuni fiindcă fracția se calculează pe cea mai
 * gravă dintre ele — o singură infracțiune introdusă ar da un răspuns corect
 * doar din întâmplare, când chiar aia era cea mai gravă.
 */
export function ClassifyDialog() {
  const [open, setOpen] = useState(false);
  const [articol, setArticol] = useState("");
  const [alineat, setAlineat] = useState("");
  const [varsta, setVarsta] = useState<CategorieVarsta>("adult");
  const [adaugate, setAdaugate] = useState<Infractiune[]>([]);
  const [eroare, setEroare] = useState<string | null>(null);

  const alineate = useMemo(
    () => (articol.trim() ? [...new Set(alineatePentru(articol.trim()))] : []),
    [articol],
  );

  const adauga = () => {
    const inf = gasesteInfractiune(articol.trim(), alineat.trim());
    if (!inf) {
      setEroare(`Art. ${articol} alin. ${alineat} nu e în catalog.`);
      return;
    }
    // Aceeași infracțiune de două ori n-ar schimba cea mai gravă, dar ar face
    // lista să pară o socoteală în care nu te mai poți încrede.
    if (adaugate.some((x) => x.art === inf.art && x.alin === inf.alin)) {
      setEroare("E deja în listă.");
      return;
    }
    setAdaugate((p) => [...p, inf]);
    setArticol("");
    setAlineat("");
    setEroare(null);
  };

  const grava = ceaMaiGrava(adaugate);
  const f = grava.categorie ? fractiuni(grava.categorie, varsta) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Scale className="mr-2 h-4 w-4" />
          Clasificare infracțiune
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Clasificarea infracțiunii</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr,1fr,auto] items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="c-art">Articol</Label>
              <Input
                id="c-art"
                value={articol}
                onChange={(e) => {
                  setArticol(e.target.value);
                  setAlineat("");
                  setEroare(null);
                }}
                placeholder="145"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label>Alineat</Label>
              <Select value={alineat} onValueChange={setAlineat} disabled={!alineate.length}>
                <SelectTrigger>
                  <SelectValue placeholder={alineate.length ? "alege" : "—"} />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {alineate.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={adauga} disabled={!articol.trim() || !alineat}>
              Adaugă
            </Button>
          </div>

          {eroare && <p className="text-xs text-destructive">{eroare}</p>}

          {adaugate.length > 0 && (
            <ul className="space-y-1">
              {adaugate.map((inf) => (
                <li
                  key={`${inf.art}-${inf.alin}`}
                  className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px]"
                >
                  <span className="min-w-0 flex-1">
                    Art. {inf.art} alin. {inf.alin}
                    <span className="ml-2 text-xs text-muted-foreground">{inf.pedeapsa_max}</span>
                  </span>
                  <span
                    className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TON[inf.cat])}
                  >
                    {CATEGORII[inf.cat].denumire}
                  </span>
                  <button
                    type="button"
                    aria-label="Scoate din listă"
                    onClick={() =>
                      setAdaugate((p) =>
                        p.filter((x) => !(x.art === inf.art && x.alin === inf.alin)),
                      )
                    }
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <Label>Categoria de vârstă</Label>
            <Select value={varsta} onValueChange={(v) => setVarsta(v as CategorieVarsta)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORII_VARSTA) as CategorieVarsta[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CATEGORII_VARSTA[k].denumire}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {grava.categorie && f && (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
              <div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    TON[grava.categorie],
                  )}
                >
                  {CATEGORII[grava.categorie].denumire}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">
                  hotărâtă de {grava.articolDeterminant}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <p className="text-lg font-semibold tabular-nums">{f.art91.fractiune}</p>
                  <p className="text-xs text-muted-foreground">
                    Art. 91 — liberare condiționată
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{f.art91.temeiLegal}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums">{f.art92.fractiune}</p>
                  <p className="text-xs text-muted-foreground">
                    Art. 92 — înlocuirea părții neexecutate
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{f.art92.temeiLegal}</p>
                </div>
              </div>

              {f.art91.nota && (
                <p className="border-t pt-3 text-xs text-amber-800">{f.art91.nota}</p>
              )}
              <p className="text-xs text-muted-foreground">Rezultatul e orientativ.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
