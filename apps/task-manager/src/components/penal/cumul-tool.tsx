"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { temeiCumul, type Temei } from "@/lib/penal/cumul";
import { cn } from "@/lib/utils";

/**
 * Care articol se aplică la a doua sentință.
 *
 * Unealta răspunde la o singură întrebare și se oprește acolo: pedeapsa
 * definitivă o stabilește instanța, prin cumul total sau parțial, iar un
 * calculator care ar da o cifră ar da-o cu aerul că e singura posibilă. Ce se
 * poate spune fără urmă de îndoială e temeiul — și tocmai el se încurcă, fiindcă
 * amândouă articolele vorbesc despre un om cu două sentințe.
 */

interface Descriere {
  titlu: string;
  temeiLegal: string;
  ton: string;
  urmarea: string;
  plafon?: string;
}

const DESCRIERI: Record<Temei, Descriere> = {
  art84: {
    titlu: "Concurs de infracțiuni",
    temeiLegal: "art. 84 alin. (4) CP RM",
    ton: "bg-blue-100 text-blue-700",
    urmarea:
      "Pedeapsa definitivă se stabilește prin cumul, total sau parțial, al pedepselor aplicate. Durata deja executată în baza primei sentințe INTRĂ în termen. Dacă toate faptele sunt ușoare și/sau mai puțin grave, pedeapsa mai ușoară poate fi absorbită de cea mai aspră.",
    plafon: "25 de ani — 20 pentru cei între 18 și 21 de ani, 12 ani și 6 luni pentru minori",
  },
  art85: {
    titlu: "Cumul de sentințe",
    temeiLegal: "art. 85 CP RM",
    ton: "bg-amber-100 text-amber-800",
    urmarea:
      "La pedeapsa aplicată prin noua sentință SE ADAUGĂ, în întregime sau parțial, partea neexecutată din pedeapsa anterioară. Definitiva trebuie să fie mai mare și decât pedeapsa nouă, și decât partea neexecutată. Dacă una dintre sentințe e detențiune pe viață, definitiva e detențiune pe viață.",
    plafon: "30 de ani — 20 pentru cei între 18 și 21 de ani, 15 pentru minori",
  },
  niciunul: {
    titlu: "Nici concurs, nici cumul",
    temeiLegal: "cauză de sine stătătoare",
    ton: "bg-muted text-foreground",
    urmarea:
      "Fapta a fost săvârșită după executarea completă a primei pedepse, deci art. 85 nu se aplică — el cere ca fapta să fie săvârșită înainte de executarea completă. Pedeapsa se stabilește numai pentru noua infracțiune.",
  },
};

export function CumulTool() {
  const [savarsire, setSavarsire] = useState("");
  const [pronuntare, setPronuntare] = useState("");
  const [sfarsitPrimei, setSfarsitPrimei] = useState("");

  const data = (s: string) => {
    if (!s) return null;
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const dataRo = (d: Date) => format(d, "d MMMM yyyy", { locale: ro });

  const dSavarsire = data(savarsire);
  const dPronuntare = data(pronuntare);
  const dSfarsit = data(sfarsitPrimei);

  const rezultat =
    dSavarsire && dPronuntare
      ? temeiCumul({
          savarsire: dSavarsire,
          pronuntare: dPronuntare,
          sfarsitPrimei: dSfarsit,
        })
      : null;
  const d = rezultat ? DESCRIERI[rezultat.temei] : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="c-savarsire">Data săvârșirii noii infracțiuni</Label>
          <Input
            id="c-savarsire"
            type="date"
            value={savarsire}
            onChange={(e) => setSavarsire(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-pronuntare">Data pronunțării primei sentințe</Label>
          <Input
            id="c-pronuntare"
            type="date"
            value={pronuntare}
            onChange={(e) => setPronuntare(e.target.value)}
          />
          {/* Pronunțarea, nu rămânerea definitivă: așa scrie în amândouă
              articolele, iar între ele pot trece luni. */}
          <p className="text-xs text-muted-foreground">
            Ziua pronunțării, nu cea a rămânerii definitive — așa scrie în amândouă
            articolele.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-sfarsit">
            Sfârșitul primei pedepse{" "}
            <span className="font-normal text-muted-foreground">(dacă e cunoscut)</span>
          </Label>
          <Input
            id="c-sfarsit"
            type="date"
            value={sfarsitPrimei}
            onChange={(e) => setSfarsitPrimei(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Fără el nu se poate ști dacă pedeapsa era executată integral la data faptei,
            iar art. 85 cere anume ca ea să nu fi fost.
          </p>
        </div>
      </section>

      {rezultat && d && dSavarsire && dPronuntare ? (
        <section className="space-y-3 rounded-xl border bg-muted/40 p-5">
          <div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", d.ton)}>
              {d.titlu}
            </span>
            <p className="mt-2 text-lg font-semibold">{d.temeiLegal}</p>
          </div>

          {/* De ce, în cuvintele datelor introduse: un temei fără motivul lui nu
              se poate verifica, iar aici verificarea o face un om. */}
          <p className="border-t pt-3 text-sm">
            {rezultat.temei === "art84"
              ? `Fapta a fost săvârșită la ${dataRo(dSavarsire)}, înainte de pronunțarea primei sentințe (${dataRo(dPronuntare)}).`
              : rezultat.temei === "art85"
                ? `Fapta a fost săvârșită la ${dataRo(dSavarsire)}, după pronunțarea primei sentințe (${dataRo(dPronuntare)})${
                    dSfarsit ? ` și înainte de sfârșitul ei (${dataRo(dSfarsit)})` : ""
                  }.`
                : `Fapta a fost săvârșită la ${dataRo(dSavarsire)}, după executarea completă a primei pedepse${
                    dSfarsit ? ` (${dataRo(dSfarsit)})` : ""
                  }.`}
          </p>

          {rezultat.aceeasiZi && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Fapta e săvârșită chiar în ziua pronunțării. „Înainte” și „după” se despart
              la ora citirii sentinței, iar data singură nu o cuprinde: dacă fapta a fost
              săvârșită mai devreme în acea zi, se aplică art. 84 alin. (4).
            </p>
          )}

          <p className="border-t pt-3 text-xs text-muted-foreground">{d.urmarea}</p>

          {d.plafon && (
            <p className="text-xs text-muted-foreground">
              Pedeapsa definitivă nu poate depăși {d.plafon}.
            </p>
          )}

          {rezultat.temei === "art85" && !dSfarsit && (
            <p className="text-xs text-muted-foreground">
              Sub condiția că pedeapsa nu era executată integral la data faptei — completează
              sfârșitul primei pedepse ca să se verifice și asta.
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-dashed p-5">
          <p className="text-sm text-muted-foreground">
            Hotărăște data săvârșirii față de data pronunțării: fapta dinainte de prima
            sentință e concurs de infracțiuni, cea de după e cumul de sentințe. Nu contează
            gravitatea, ordinea în care au venit sentințele și nici când s-a descoperit
            fapta.
          </p>
        </section>
      )}
    </div>
  );
}
