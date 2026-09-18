import { describe, expect, it } from "vitest";
import {
  CATEGORY_FILTER_OPTIONS,
  activeDefendants,
  convictedDefendants,
  countDefendants,
  categoryOf,
  filterByCategory,
  fullName,
  type Defendant,
} from "./defendants";

const d = (over: Partial<Defendant>): Defendant => ({
  id: "1", last_name: "Popescu", first_name: "Ion", regime: "inchis",
  established_on: "2026-08-01", court: null, case_number: null,
  status: "inculpat", preventive_measure: false, preventive_measure_on: null, convicted_on: null, note: null,
  created_by: null, updated_by: null, created_at: "", updated_at: "", ...over,
});

describe("countDefendants", () => {
  it("numără pe tip doar inculpații", () => {
    // Un condamnat amestecat în cifrele pe tip ar face „câți avem acum" să
    // crească la nesfârșit — adică numărul pe care nimeni nu-l poate folosi.
    const c = countDefendants([
      d({ id: "a", regime: "inchis" }),
      d({ id: "b", regime: "semiinchis" }),
      d({ id: "c", regime: "inchis", status: "condamnat", convicted_on: "2026-08-02" }),
    ]);
    expect(c.inchis).toBe(1);
    expect(c.semiinchis).toBe(1);
    expect(c.inculpati).toBe(2);
    expect(c.condamnati).toBe(1);
    expect(c.total).toBe(3);
  });

  it("suma pe tip e egală cu numărul de inculpați", () => {
    const rows = [
      d({ id: "a", regime: "inchis" }),
      d({ id: "b", regime: "inchis" }),
      d({ id: "c", regime: "semiinchis" }),
      d({ id: "x", status: "condamnat", convicted_on: "2026-08-02" }),
    ];
    const c = countDefendants(rows);
    expect(c.inchis + c.semiinchis).toBe(c.inculpati);
  });

  it("registru gol", () => {
    expect(countDefendants([])).toEqual({
      activi: 0, preveniti: 0, inculpati: 0,
      inchis: 0, semiinchis: 0, condamnati: 0, total: 0,
      peCategorie: {
        prevenit: { inchis: 0, semiinchis: 0, total: 0 },
        inculpat: { inchis: 0, semiinchis: 0, total: 0 },
      },
    });
  });

  describe("împărțirea pe tip, în fiecare categorie", () => {
    const rows = [
      d({ id: "p1", preventive_measure: true, regime: "inchis" }),
      d({ id: "p2", preventive_measure: true, regime: "inchis" }),
      d({ id: "p3", preventive_measure: true, regime: "semiinchis" }),
      d({ id: "i1", preventive_measure: false, regime: "inchis" }),
      d({ id: "i2", preventive_measure: false, regime: "semiinchis" }),
      // Condamnat: are și măsură, și tip, dar a ieșit din grija curentă.
      d({
        id: "c1", preventive_measure: true, regime: "inchis",
        status: "condamnat", convicted_on: "2026-08-20",
      }),
    ];

    it("fiecare categorie își are tipurile numărate", () => {
      const c = countDefendants(rows);
      expect(c.peCategorie.prevenit).toEqual({ inchis: 2, semiinchis: 1, total: 3 });
      expect(c.peCategorie.inculpat).toEqual({ inchis: 1, semiinchis: 1, total: 2 });
    });

    it("condamnatul nu intră în nicio căsuță", () => {
      // Are măsură preventivă și tip închis; dacă ar fi numărat, preveniții
      // închiși ar fi 3 în loc de 2, iar banda ar arăta mai mulți oameni în
      // grijă decât sunt.
      const c = countDefendants(rows);
      expect(c.peCategorie.prevenit.inchis).toBe(2);
      expect(c.condamnati).toBe(1);
    });

    it("marginile tabelului sunt chiar cifrele vechi", () => {
      // Cifrele din bandă se adună acum din tabel, nu dintr-o a doua trecere
      // prin registru. Dacă vreodată s-ar despărți, asta pică.
      const c = countDefendants(rows);
      const { prevenit, inculpat } = c.peCategorie;
      expect(c.preveniti).toBe(prevenit.total);
      expect(c.inculpati).toBe(inculpat.total);
      expect(c.inchis).toBe(prevenit.inchis + inculpat.inchis);
      expect(c.semiinchis).toBe(prevenit.semiinchis + inculpat.semiinchis);
      expect(c.activi).toBe(prevenit.total + inculpat.total);
      expect(c.activi).toBe(c.inchis + c.semiinchis);
    });

    it("totalul fiecărei categorii e suma tipurilor ei", () => {
      const c = countDefendants(rows);
      for (const cat of [c.peCategorie.prevenit, c.peCategorie.inculpat]) {
        expect(cat.total).toBe(cat.inchis + cat.semiinchis);
      }
    });
  });
});

describe("activeDefendants", () => {
  it("doar inculpații, alfabetic", () => {
    const rows = [
      d({ id: "v", last_name: "Vasilescu", first_name: "Ana" }),
      d({ id: "c", last_name: "Cojocaru", first_name: "B" }),
      d({ id: "x", last_name: "Adam", first_name: "C", status: "condamnat", convicted_on: "2026-08-02" }),
    ];
    expect(activeDefendants(rows).map((r) => r.id)).toEqual(["c", "v"]);
  });

  it("ordonarea ține cont de diacritice", () => {
    const rows = [
      d({ id: "s", last_name: "Șerban", first_name: "A" }),
      d({ id: "t", last_name: "Toma", first_name: "A" }),
    ];
    // În ordinea românească, Ș vine înaintea lui T.
    expect(activeDefendants(rows).map((r) => r.id)).toEqual(["s", "t"]);
  });
});

describe("convictedDefendants", () => {
  it("cei mai recent condamnați primii", () => {
    const rows = [
      d({ id: "vechi", status: "condamnat", convicted_on: "2026-06-01" }),
      d({ id: "nou", status: "condamnat", convicted_on: "2026-08-01" }),
      d({ id: "inculpat" }),
    ];
    expect(convictedDefendants(rows).map((r) => r.id)).toEqual(["nou", "vechi"]);
  });
});

describe("fullName", () => {
  it("numele înaintea prenumelui, ca în registru", () => {
    expect(fullName(d({ last_name: "Popescu", first_name: "Ion" }))).toBe("Popescu Ion");
  });
});

describe("categoria, citită din măsură", () => {
  it("necondamnat cu măsură preventivă e prevenit", () => {
    expect(categoryOf(d({ preventive_measure: true }))).toBe("prevenit");
  });

  it("necondamnat fără măsură e inculpat", () => {
    expect(categoryOf(d({ preventive_measure: false }))).toBe("inculpat");
  });

  it("condamnarea are întâietate asupra măsurii", () => {
    // Odată condamnat, măsura preventivă nu-l mai descrie — altfel același om
    // ar fi numărat și la preveniți, și la condamnați.
    const x = d({ status: "condamnat", convicted_on: "2026-08-20", preventive_measure: true });
    expect(categoryOf(x)).toBe("condamnat");
  });
});

describe("cifrele registrului, cu ambele categorii", () => {
  const rows = [
    d({ id: "1", preventive_measure: true, regime: "inchis" }),
    d({ id: "2", preventive_measure: true, regime: "semiinchis" }),
    d({ id: "3", preventive_measure: false, regime: "inchis" }),
    d({ id: "4", status: "condamnat", convicted_on: "2026-08-20", preventive_measure: true }),
  ];

  it("preveniții și inculpații se numără separat", () => {
    const c = countDefendants(rows);
    expect(c.preveniti).toBe(2);
    expect(c.inculpati).toBe(1);
    expect(c.condamnati).toBe(1);
  });

  it("cele două împărțiri dau același total", () => {
    // Invariantul care ține banda de cifre cinstită: aceiași oameni, numărați
    // în două feluri. Dacă se rup, una dintre cifre minte.
    const c = countDefendants(rows);
    expect(c.preveniti + c.inculpati).toBe(c.activi);
    expect(c.inchis + c.semiinchis).toBe(c.activi);
  });

  it("condamnatul nu intră în niciuna dintre împărțiri", () => {
    const c = countDefendants(rows);
    expect(c.activi).toBe(3);
    expect(c.total).toBe(4);
  });
});

describe("filterByCategory", () => {
  /*
   * Scrise DINADINS în dezordine alfabetică (Cornea, Albu, Dinu, Barbu).
   *
   * Sortate, probele de mai jos n-ar putea deosebi „păstrează ordinea primită"
   * de „sortează alfabetic" — amândouă ar da același răspuns, iar un filtru
   * care ar re-sorta pe ascuns ar trece nevăzut. Ordinea alfabetică e treaba
   * lui `activeDefendants`, nu a filtrului.
   */
  const rows = [
    d({ id: "p2", last_name: "Cornea", first_name: "C", preventive_measure: true }),
    d({ id: "p1", last_name: "Albu", first_name: "A", preventive_measure: true }),
    d({
      id: "c1", last_name: "Dinu", first_name: "D",
      status: "condamnat", convicted_on: "2026-08-20", preventive_measure: true,
    }),
    d({ id: "i1", last_name: "Barbu", first_name: "B", preventive_measure: false }),
  ];

  it("„toți” întoarce tot ce a primit, în aceeași ordine", () => {
    expect(filterByCategory(rows, "toti").map((r) => r.id)).toEqual([
      "p2", "p1", "c1", "i1",
    ]);
  });

  it("„preveniți” lasă doar necondamnații cu măsură preventivă", () => {
    // Ordinea e cea de la intrare, nu cea alfabetică: Cornea înaintea lui Albu.
    expect(filterByCategory(rows, "prevenit").map((r) => r.id)).toEqual(["p2", "p1"]);
  });

  it("„inculpați” lasă doar necondamnații fără măsură preventivă", () => {
    expect(filterByCategory(rows, "inculpat").map((r) => r.id)).toEqual(["i1"]);
  });

  it("condamnatul cu măsura rămasă bifată nu iese la niciuna dintre categorii", () => {
    // Cazul pentru care filtrul citește prin `categoryOf`: măsura preventivă a
    // rămas în rând după condamnare, dar nu-l mai descrie. Dacă s-ar citi
    // direct din `preventive_measure`, omul ar apărea și la „Preveniți”, și în
    // secțiunea condamnaților — de două ori pe aceeași pagină.
    const ids = [
      ...filterByCategory(rows, "prevenit"),
      ...filterByCategory(rows, "inculpat"),
    ].map((r) => r.id);
    expect(ids).not.toContain("c1");
  });

  it("registru gol dă listă goală pentru toate cele trei alegeri", () => {
    expect(filterByCategory([], "toti")).toEqual([]);
    expect(filterByCategory([], "prevenit")).toEqual([]);
    expect(filterByCategory([], "inculpat")).toEqual([]);
  });

  it("nu reordonează ce primește deja sortat", () => {
    // Se aplică după `activeDefendants`, deci ordinea alfabetică trebuie să
    // treacă prin filtru neatinsă.
    const sortate = activeDefendants(rows);
    expect(filterByCategory(sortate, "toti").map((r) => r.id)).toEqual(
      sortate.map((r) => r.id),
    );
    expect(filterByCategory(sortate, "prevenit").map((r) => r.id)).toEqual(["p1", "p2"]);
  });

  it("filtrul și banda de cifre spun același lucru", () => {
    // Invariantul care leagă pastilele de cifrele de deasupra lor: dacă se
    // rupe, utilizatorul vede scris „Preveniți: 2" peste o listă cu trei.
    const c = countDefendants(rows);
    const activi = activeDefendants(rows);
    const preveniti = filterByCategory(activi, "prevenit");
    const inculpati = filterByCategory(activi, "inculpat");
    expect(preveniti.length).toBe(c.preveniti);
    expect(inculpati.length).toBe(c.inculpati);
    expect(preveniti.length + inculpati.length).toBe(c.activi);
  });

  it("alegerile sunt trei, cu „toți” prima", () => {
    expect(CATEGORY_FILTER_OPTIONS).toHaveLength(3);
    expect(CATEGORY_FILTER_OPTIONS[0].value).toBe("toti");
  });
});
