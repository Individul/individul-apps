import { describe, expect, it } from "vitest";
import { temeiCumul } from "./cumul";

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
