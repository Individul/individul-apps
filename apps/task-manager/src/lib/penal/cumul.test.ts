import { describe, expect, it } from "vitest";
import { lantulTemeiurilor, temeiCumul } from "./cumul";

const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe("art. 84 alin. (4) sau art. 85", () => {
  it("fapta dinaintea primei sentințe e concurs de infracțiuni", () => {
    // Art. 84 alin. (4): „săvârșite înainte de pronunţarea sentinţei în prima
    // cauză". Nu contează că a doua sentință vine mult mai târziu.
    const r = temeiCumul({ savarsire: d("2024-03-10"), pronuntare: d("2025-06-01") });
    expect(r.temei).toBe("art84");
  });

  it("fapta de după prima sentință e cumul de sentințe", () => {
    const r = temeiCumul({
      savarsire: d("2025-09-15"),
      pronuntare: d("2025-06-01"),
      sfarsitPrimei: d("2028-06-01"),
    });
    expect(r.temei).toBe("art85");
  });

  it("fapta de după executarea completă nu e nici una, nici alta", () => {
    // Art. 85 cere ca fapta să fie săvârșită „înainte de executarea completă a
    // pedepsei". După, e o cauză de sine stătătoare.
    const r = temeiCumul({
      savarsire: d("2028-07-01"),
      pronuntare: d("2025-06-01"),
      sfarsitPrimei: d("2028-06-01"),
    });
    expect(r.temei).toBe("niciunul");
  });

  it("fapta din chiar ultima zi de executare e tot cumul de sentințe", () => {
    // Ziua se socotește executată abia la sfârșitul ei.
    const r = temeiCumul({
      savarsire: d("2028-06-01"),
      pronuntare: d("2025-06-01"),
      sfarsitPrimei: d("2028-06-01"),
    });
    expect(r.temei).toBe("art85");
  });

  it("fără sfârșitul primei pedepse, răspunsul rămâne art. 85", () => {
    // Sub condiția, spusă pe ecran, că pedeapsa nu era executată integral: e tot
    // ce se poate ști din datele avute.
    const r = temeiCumul({ savarsire: d("2025-09-15"), pronuntare: d("2025-06-01") });
    expect(r.temei).toBe("art85");
  });

  it("fapta din ziua pronunțării se semnalează, nu se hotărăște singură", () => {
    // „Înainte" și „după" se despart la ora citirii sentinței, iar data nu o
    // conține. Un răspuns dat fără ezitare aici ar fi o ghicitoare cu aer de
    // socoteală.
    const r = temeiCumul({ savarsire: d("2025-06-01"), pronuntare: d("2025-06-01") });
    expect(r.aceeasiZi).toBe(true);
    expect(r.temei).toBe("art85");
  });

  it("în orice altă zi nu se semnalează nimic", () => {
    expect(temeiCumul({ savarsire: d("2025-05-31"), pronuntare: d("2025-06-01") }).aceeasiZi)
      .toBe(false);
    expect(temeiCumul({ savarsire: d("2025-06-02"), pronuntare: d("2025-06-01") }).aceeasiZi)
      .toBe(false);
  });

  it("ora din date nu schimbă răspunsul", () => {
    // Câmpurile de dată dau miezul nopții, dar o dată venită din altă parte
    // poate purta orice oră; ziua trebuie să hotărască, nu ceasul.
    const r = temeiCumul({
      savarsire: new Date("2025-06-01T23:30:00"),
      pronuntare: new Date("2025-06-01T00:10:00"),
    });
    expect(r.aceeasiZi).toBe(true);
  });
});

describe("lanțul de sentințe", () => {
  const s = (pronuntare: string, savarsire: string, sfarsit?: string) => ({
    pronuntare: d(pronuntare),
    savarsire: d(savarsire),
    sfarsit: sfarsit ? d(sfarsit) : null,
  });

  it("fiecare sentință se cântărește față de cea dinaintea ei", () => {
    // Cazul care a ridicat întrebarea: fapta a treia (01.09.2025) e săvârșită
    // între primele două sentințe (01.01.2025 și 01.06.2026). Față de prima ar
    // fi art. 85, față de a doua e art. 84 — și a doua hotărăște, fiindcă ea a
    // stabilit pedeapsa aflată în executare când a venit a treia.
    const pasi = lantulTemeiurilor([
      s("2025-01-01", "2024-05-10"),
      s("2026-06-01", "2025-03-01"),
      s("2027-03-01", "2025-09-01"),
    ]);
    expect(pasi.map((p) => p.temei)).toEqual(["art85", "art84"]);
  });

  it("le pune în ordinea pronunțării, oricum ar fi introduse", () => {
    // Din dosar ies în ordinea în care s-au găsit, nu a calendarului.
    const pasi = lantulTemeiurilor([
      s("2027-03-01", "2025-09-01"),
      s("2025-01-01", "2024-05-10"),
      s("2026-06-01", "2025-03-01"),
    ]);
    expect(pasi.map((p) => p.numar)).toEqual([2, 3]);
    expect(pasi.map((p) => p.temei)).toEqual(["art85", "art84"]);
  });

  it("prima sentință n-are treaptă a ei", () => {
    // Nu e nimic de cumulat cu ea; treptele încep de la a doua.
    expect(lantulTemeiurilor([s("2025-01-01", "2024-05-10")])).toEqual([]);
    expect(lantulTemeiurilor([])).toEqual([]);
  });

  it("un lanț întreg de concursuri rămâne concurs la fiecare treaptă", () => {
    const pasi = lantulTemeiurilor([
      s("2025-01-01", "2024-01-10"),
      s("2025-06-01", "2024-02-10"),
      s("2026-01-01", "2024-03-10"),
    ]);
    expect(pasi.map((p) => p.temei)).toEqual(["art84", "art84"]);
  });

  it("sfârșitul pedepsei anterioare se ia de la treapta ei, nu de la prima", () => {
    // A treia faptă e săvârșită după ce se încheiase pedeapsa din sentința a
    // doua, deci acolo nu mai e nici concurs, nici cumul.
    const pasi = lantulTemeiurilor([
      s("2025-01-01", "2024-05-10", "2025-12-31"),
      s("2026-06-01", "2025-09-01", "2027-01-01"),
      s("2028-03-01", "2027-06-01"),
    ]);
    expect(pasi.map((p) => p.temei)).toEqual(["art85", "niciunul"]);
  });

  it("fapta datată după propria sentință se semnalează", () => {
    // Nu se poate ști care dintre cele două date e greșită, deci nu se
    // corectează nimic — se arată.
    const pasi = lantulTemeiurilor([
      s("2025-01-01", "2024-05-10"),
      s("2026-06-01", "2027-01-01"),
    ]);
    expect(pasi[0].dataImposibila).toBe(true);
  });
});
