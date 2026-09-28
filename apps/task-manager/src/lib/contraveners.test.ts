import { describe, expect, it } from "vitest";
import {
  MAX_ARREST_DAYS,
  fullName,
  matchesContravener,
  sortContraveners,
  validateContravener,
  type Contravener,
  type ContravenerInput,
} from "./contraveners";

const bun: ContravenerInput = {
  last_name: "Cebotari",
  first_name: "Ion",
  patronymic: "Vasile",
  decision_date: "2026-09-10",
  final_date: "2026-09-25",
  arrest_days: "15",
};

const c = (x: Partial<Contravener> & { id: string }): Contravener => ({
  last_name: "Popescu",
  first_name: "Ion",
  patronymic: null,
  decision_date: "2026-09-01",
  final_date: null,
  arrest_days: 10,
  created_by: null,
  updated_by: null,
  created_at: "2026-09-01T09:00:00+00:00",
  updated_at: "2026-09-01T09:00:00+00:00",
  ...x,
});

describe("validateContravener", () => {
  it("un formular complet trece", () => {
    expect(validateContravener(bun)).toBeNull();
  });

  it("patronimicul și data devenirii definitive pot lipsi", () => {
    expect(validateContravener({ ...bun, patronymic: "", final_date: "" })).toBeNull();
  });

  it("numele și prenumele sunt obligatorii, și nu doar spații", () => {
    expect(validateContravener({ ...bun, last_name: "  " })).toMatch(/Numele/);
    expect(validateContravener({ ...bun, first_name: "" })).toMatch(/Prenumele/);
  });

  it("data hotărârii e obligatorie", () => {
    expect(validateContravener({ ...bun, decision_date: "" })).toMatch(/hotărârii/);
  });

  it("o zi care nu există e respinsă, deși are forma bună", () => {
    // „30 februarie" trece de tiparul AAAA-LL-ZZ; V8 ar face din ea 2 martie.
    expect(validateContravener({ ...bun, decision_date: "2026-02-30" })).toMatch(/nu e o zi/);
    expect(validateContravener({ ...bun, final_date: "2026-13-01" })).toMatch(/nu e o zi/);
  });

  it("hotărârea nu devine definitivă înainte de data ei", () => {
    expect(
      validateContravener({ ...bun, decision_date: "2026-09-10", final_date: "2026-09-09" }),
    ).toMatch(/înainte de data ei/);
  });

  it("definitivă chiar în ziua hotărârii e în regulă", () => {
    expect(
      validateContravener({ ...bun, decision_date: "2026-09-10", final_date: "2026-09-10" }),
    ).toBeNull();
  });

  it("zilele sunt un număr întreg pozitiv", () => {
    expect(validateContravener({ ...bun, arrest_days: "" })).toMatch(/obligatoriu/);
    expect(validateContravener({ ...bun, arrest_days: "0" })).toMatch(/cel puțin o zi/);
    expect(validateContravener({ ...bun, arrest_days: "12.5" })).toMatch(/întreg/);
    expect(validateContravener({ ...bun, arrest_days: "-3" })).toMatch(/întreg/);
    // `Number("1e1")` e 10 — fără verificarea pe cifre ar trece drept „10 zile".
    expect(validateContravener({ ...bun, arrest_days: "1e1" })).toMatch(/întreg/);
  });

  it("plafonul prinde cifra apăsată de două ori", () => {
    expect(validateContravener({ ...bun, arrest_days: String(MAX_ARREST_DAYS) })).toBeNull();
    expect(validateContravener({ ...bun, arrest_days: String(MAX_ARREST_DAYS + 1) })).toMatch(
      /nu trece de/,
    );
    expect(validateContravener({ ...bun, arrest_days: "300" })).toMatch(/nu trece de/);
  });

  it("spațiile din jurul zilelor nu strică nimic", () => {
    expect(validateContravener({ ...bun, arrest_days: " 15 " })).toBeNull();
  });
});

describe("fullName", () => {
  it("nume, prenume, patronimic, în ordinea asta", () => {
    expect(fullName({ last_name: "Cebotari", first_name: "Ion", patronymic: "Vasile" })).toBe(
      "Cebotari Ion Vasile",
    );
  });

  it("fără patronimic nu lasă spațiu în plus", () => {
    expect(fullName({ last_name: "Smith", first_name: "John", patronymic: null })).toBe(
      "Smith John",
    );
  });
});

describe("sortContraveners", () => {
  it("cele mai recente hotărâri întâi", () => {
    const rows = [
      c({ id: "vechi", decision_date: "2026-08-01" }),
      c({ id: "nou", decision_date: "2026-09-20" }),
      c({ id: "mijloc", decision_date: "2026-09-01" }),
    ];
    expect(sortContraveners(rows).map((r) => r.id)).toEqual(["nou", "mijloc", "vechi"]);
  });

  it("la aceeași zi decide numele, ca ordinea să nu sară", () => {
    const rows = [
      c({ id: "t", last_name: "Țurcanu", decision_date: "2026-09-10" }),
      c({ id: "a", last_name: "Albu", decision_date: "2026-09-10" }),
    ];
    expect(sortContraveners(rows).map((r) => r.id)).toEqual(["a", "t"]);
  });

  it("nu strică lista primită", () => {
    const rows = [c({ id: "1", decision_date: "2026-08-01" }), c({ id: "2", decision_date: "2026-09-01" })];
    sortContraveners(rows);
    expect(rows.map((r) => r.id)).toEqual(["1", "2"]);
  });
});

describe("matchesContravener", () => {
  const ion = c({ id: "1", last_name: "Țurcanu", first_name: "Ion", patronymic: "Ștefan" });

  it("căutarea goală le arată pe toate", () => {
    expect(matchesContravener(ion, "")).toBe(true);
    expect(matchesContravener(ion, "   ")).toBe(true);
  });

  it("nu ține seama de diacritice și de majuscule", () => {
    expect(matchesContravener(ion, "turcanu")).toBe(true);
    expect(matchesContravener(ion, "TURC")).toBe(true);
  });

  it("caută și în patronimic", () => {
    expect(matchesContravener(ion, "stefan")).toBe(true);
  });

  it("un nume străin nu se potrivește", () => {
    expect(matchesContravener(ion, "Popescu")).toBe(false);
  });
});
