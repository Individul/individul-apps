import { describe, expect, it } from "vitest";
import { fractiuni, type Categorie } from "./categorii";
import {
  INFRACTIUNI,
  alineatePentru,
  articole,
  ceaMaiGrava,
  gasesteInfractiune,
  parseArticol,
} from "./clasificare";
import {
  adaugaTermen,
  calculeazaTermen,
  fractieDinTermen,
  scadeArest,
  sfarsitTermen,
  zileIntre,
  termenText,
} from "./termene";

const zi = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("catalogul de infracțiuni", () => {
  it("a fost portat întreg", () => {
    // Dacă la o actualizare se pierd intrări, aici se vede.
    expect(INFRACTIUNI.length).toBe(664);
    expect(articole().length).toBe(250);
  });

  it("fiecare intrare are o categorie cunoscută", () => {
    const valide: Categorie[] = ["U", "MPG", "G", "DG", "EG"];
    const straine = INFRACTIUNI.filter((i) => !valide.includes(i.cat));
    expect(straine).toEqual([]);
  });
});

describe("găsirea infracțiunii", () => {
  it("potrivire directă pe articol și alineat", () => {
    expect(gasesteInfractiune("145", "1")?.cat).toBe("DG");
    expect(gasesteInfractiune("145", "2")?.cat).toBe("EG");
  });

  it("alineatele cu exponent se găsesc", () => {
    // „1¹" nu e „11": exponentul face parte din alineat.
    expect(gasesteInfractiune("149", "1¹")).not.toBeNull();
  });

  it("bara face parte din articol, nu e alineat", () => {
    // În Codul penal „217/1" e numărul articolului.
    expect(parseArticol("217/1")).toEqual({ articol: "217", alineatDinArticol: "1" });
  });

  it("un articol inexistent nu întoarce nimic", () => {
    expect(gasesteInfractiune("9999", "1")).toBeNull();
  });

  it("alineatele unui articol se pot lista", () => {
    expect(alineatePentru("145")).toContain("1");
    expect(alineatePentru("145")).toContain("2");
  });
});

describe("cea mai gravă categorie", () => {
  const inf = (art: string, alin: string, cat: Categorie) => ({ art, alin, cat, pedeapsa_max: "" });

  it("dintre mai multe, hotărăște cea mai gravă", () => {
    const r = ceaMaiGrava([inf("1", "1", "U"), inf("145", "2", "EG"), inf("2", "1", "G")]);
    expect(r.categorie).toBe("EG");
    expect(r.articolDeterminant).toBe("Art. 145 alin. 2");
  });

  it("fără infracțiuni, nu hotărăște nimic", () => {
    expect(ceaMaiGrava([]).categorie).toBeNull();
  });
});

describe("fracțiile art. 91 și 92", () => {
  it("adultul nu beneficiază de reducere", () => {
    const f = fractiuni("G", "adult");
    expect(f.art91.fractiune).toBe("2/3");
    expect(f.art91.temeiLegal).toBe("art. 91 alin. (4) lit. b) CP RM");
  });

  it("minorul beneficiază", () => {
    expect(fractiuni("G", "minor").art91.fractiune).toBe("1/2");
  });

  it("nota de 90 de zile apare doar la adult, U și MPG", () => {
    expect(fractiuni("U", "adult").art91.nota).toContain("90");
    expect(fractiuni("U", "minor").art91.nota).toBeNull();
    expect(fractiuni("G", "adult").art91.nota).toBeNull();
  });

  it("art. 92 nu ține seama de vârstă", () => {
    expect(fractiuni("G", "adult").art92.fractiune).toBe(fractiuni("G", "minor").art92.fractiune);
  });
});

describe("sfârșitul termenului", () => {
  it("un an expiră în ziua precedentă", () => {
    // Regula RM: un an de la 10 martie 2026 se încheie pe 9 martie 2027.
    expect(zi(sfarsitTermen(new Date(2026, 2, 10), { ani: 1, luni: 0, zile: 0 })))
      .toBe("2027-03-09");
  });

  it("la termenul numai în luni NU se scade ziua", () => {
    // Confirmat de utilizator: ziua precedentă e regulă doar pentru ani.
    expect(zi(sfarsitTermen(new Date(2026, 0, 10), { ani: 0, luni: 6, zile: 0 })))
      .toBe("2026-07-10");
  });

  it("la termenul micst, cu zile, NU se scade ziua", () => {
    // Cazul dat de utilizator: 10.03.2026 + 2 ani, 6 luni și 10 zile.
    expect(zi(sfarsitTermen(new Date(2026, 2, 10), { ani: 2, luni: 6, zile: 10 })))
      .toBe("2028-09-20");
  });

  it("la termenul numai în zile NU se scade ziua", () => {
    // Confirmat: 30 de zile de la 10 martie se încheie pe 9 aprilie.
    expect(zi(sfarsitTermen(new Date(2026, 2, 10), { ani: 0, luni: 0, zile: 30 })))
      .toBe("2026-04-09");
  });

  it("la ani plus luni NU se scade: nu e termen numai în ani", () => {
    expect(zi(sfarsitTermen(new Date(2026, 2, 10), { ani: 2, luni: 6, zile: 0 })))
      .toBe("2028-09-10");
  });

  it("adăugarea fără scăderea zilei dă chiar ziua corespunzătoare", () => {
    expect(zi(adaugaTermen(new Date(2026, 2, 10), { ani: 1, luni: 0, zile: 0 })))
      .toBe("2027-03-10");
  });

  it("o lună de la 31 ianuarie se încheie pe 28 februarie", () => {
    // Cazul dat de utilizator. „31 februarie" nu există, deci termenul expiră
    // în ultima zi a lunii — iar atunci nu se mai scade ziua, fiindcă ultima zi
    // E chiar expirarea. Aplicația de origine dădea 2 martie, rostogolind luna.
    expect(zi(sfarsitTermen(new Date(2026, 0, 31), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-02-28");
  });

  it("nici de la 30 ianuarie nu se trece în martie", () => {
    expect(zi(sfarsitTermen(new Date(2026, 0, 30), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-02-28");
  });

  it("o lună de la 1 martie se încheie pe 1 aprilie", () => {
    // Confirmat de utilizator. Ziua nu se scade la termenele în luni, deci
    // rezultatul e data corespunzătoare din luna următoare, nu ziua dinainte.
    expect(zi(sfarsitTermen(new Date(2026, 2, 1), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-04-01");
  });

  it("un an de la 31 ianuarie nu retează: ianuarie are 31 de zile", () => {
    expect(zi(sfarsitTermen(new Date(2026, 0, 31), { ani: 1, luni: 0, zile: 0 })))
      .toBe("2027-01-30");
  });

  it("29 februarie într-un an bisect, plus un an", () => {
    // 29 februarie 2029 nu există, deci se retează la 28 și nu se scade ziua.
    expect(zi(sfarsitTermen(new Date(2028, 1, 29), { ani: 1, luni: 0, zile: 0 })))
      .toBe("2029-02-28");
  });

  it("aprilie n-are 31 de zile", () => {
    expect(zi(sfarsitTermen(new Date(2026, 2, 31), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-04-30");
  });

  it("fracțiile se retează la fel, dar nu scad ziua", () => {
    // `adaugaTermen` fără scădere: o lună de la 31 ianuarie cade pe 28 februarie.
    expect(zi(adaugaTermen(new Date(2026, 0, 31), { ani: 0, luni: 1, zile: 0 })))
      .toBe("2026-02-28");
  });

});

describe("fracția din termen", () => {
  it("jumătate dintr-un an e șase luni, nu 182 de zile", () => {
    expect(fractieDinTermen({ ani: 1, luni: 0, zile: 0 }, "1/2"))
      .toEqual({ ani: 0, luni: 6, zile: 0 });
  });

  it("două treimi din trei ani", () => {
    expect(fractieDinTermen({ ani: 3, luni: 0, zile: 0 }, "2/3"))
      .toEqual({ ani: 2, luni: 0, zile: 0 });
  });

  it("restul din luni curge în zile", () => {
    // 1 lună la 1/2 = 15 zile.
    expect(fractieDinTermen({ ani: 0, luni: 1, zile: 0 }, "1/2"))
      .toEqual({ ani: 0, luni: 0, zile: 15 });
  });

  it("zilele peste 30 se strâng înapoi în luni", () => {
    expect(fractieDinTermen({ ani: 0, luni: 5, zile: 0 }, "1/2"))
      .toEqual({ ani: 0, luni: 2, zile: 15 });
  });

  it("o fracție fără înțeles nu produce un termen", () => {
    expect(fractieDinTermen({ ani: 1, luni: 0, zile: 0 }, "-"))
      .toEqual({ ani: 0, luni: 0, zile: 0 });
  });
});

describe("zilele de arest preventiv", () => {
  it("exemplul din aplicația de origine: 29.01.2015 – 29.04.2015 = 90 zile", () => {
    // Regula [start, end): ziua de început se include, cea de sfârșit nu.
    expect(zileIntre(new Date(2015, 0, 29), new Date(2015, 3, 29))).toBe(90);
  });

  it("o singură zi de arest", () => {
    expect(zileIntre(new Date(2026, 5, 1), new Date(2026, 5, 2))).toBe(1);
  });

  it("aceeași zi înseamnă zero, nu una", () => {
    // Numărate inclusiv la ambele capete ar da 1 — o zi în plus la arest e o zi
    // în minus la pedeapsă.
    expect(zileIntre(new Date(2026, 5, 1), new Date(2026, 5, 1))).toBe(0);
  });

  it("trecerea la ora de vară nu scurtează diferența", () => {
    // În 2026 ora de vară începe pe 29 martie în Europa.
    expect(zileIntre(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
  });

  it("peste un an bisect", () => {
    expect(zileIntre(new Date(2028, 1, 1), new Date(2028, 2, 1))).toBe(29);
  });
});

describe("arestul preventiv", () => {
  it("se scade din data calculată", () => {
    expect(zi(scadeArest(new Date(2027, 2, 9), 30))).toBe("2027-02-07");
  });

  it("zero zile nu mișcă nimic", () => {
    expect(zi(scadeArest(new Date(2027, 2, 9), 0))).toBe("2027-03-09");
  });
});

describe("formula documentată", () => {
  it("data_început + termen − arest − 1 zi", () => {
    // Așa e scrisă regula în aplicația de origine. Ordinea scăderilor nu
    // schimbă rezultatul, dar testul o pironește: dacă cineva mută scăderea
    // arestului înaintea adunării termenului, regula zilei precedente s-ar
    // aplica altui număr și data ar aluneca.
    const start = new Date(2026, 2, 1);
    const termen = { ani: 3, luni: 0, zile: 0 }; // numai ani: aici se scade ziua
    const arest = zileIntre(new Date(2026, 0, 1), new Date(2026, 2, 1)); // 59 zile

    const r = calculeazaTermen(start, termen, "2/3", arest);

    const asteptat = new Date(2029, 2, 1); // 1 martie 2029
    asteptat.setDate(asteptat.getDate() - arest - 1);
    expect(zi(r.sfarsitCuArest)).toBe(zi(asteptat));
  });
});

describe("calculul întreg", () => {
  it("sfârșit, fracție și eligibilitate deodată", () => {
    // 3 ani de la 1 martie 2026, categoria gravă, adult: fracția e 2/3.
    const r = calculeazaTermen(new Date(2026, 2, 1), { ani: 3, luni: 0, zile: 0 }, "2/3", 0);
    expect(zi(r.sfarsit)).toBe("2029-02-28");
    expect(r.deExecutat).toEqual({ ani: 2, luni: 0, zile: 0 });
    expect(zi(r.eligibil)).toBe("2028-03-01");
  });

  it("arestul preventiv mută ambele date înapoi", () => {
    const r = calculeazaTermen(new Date(2026, 2, 1), { ani: 3, luni: 0, zile: 0 }, "2/3", 60);
    expect(zi(r.sfarsitCuArest)).toBe("2028-12-30");
    expect(zi(r.eligibil)).toBe("2028-01-01");
  });
});

describe("termenul scris în cuvinte", () => {
  it("toate trei unitățile", () => {
    expect(termenText({ ani: 2, luni: 6, zile: 10 })).toBe("2 ani, 6 luni și 10 zile");
  });

  it("singularul se scrie corect", () => {
    expect(termenText({ ani: 1, luni: 1, zile: 1 })).toBe("1 an, 1 lună și 1 zi");
  });

  it("termenul gol", () => {
    expect(termenText({ ani: 0, luni: 0, zile: 0 })).toBe("0 zile");
  });
});
