import { describe, expect, it } from "vitest";
import {
  activeDefendants,
  convictedDefendants,
  countDefendants,
  fullName,
  type Defendant,
} from "./defendants";

const d = (over: Partial<Defendant>): Defendant => ({
  id: "1", last_name: "Popescu", first_name: "Ion", regime: "inchis",
  established_on: "2026-08-01", court: null, case_number: null,
  status: "inculpat", convicted_on: null, note: null,
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
      inchis: 0, semiinchis: 0, inculpati: 0, condamnati: 0, total: 0,
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
