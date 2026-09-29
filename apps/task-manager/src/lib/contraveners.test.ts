import { describe, expect, it } from "vitest";
import {
  AVERTIZARE_ZILE,
  MAX_ARREST_DAYS,
  countPrescriptie,
  deInformat,
  filterContraveners,
  fullName,
  matchesContravener,
  prescriptieOf,
  sortContraveners,
  ultimaZiDeExecutare,
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
  executed_on: "",
};

const c = (x: Partial<Contravener> & { id: string }): Contravener => ({
  last_name: "Popescu",
  first_name: "Ion",
  patronymic: null,
  decision_date: "2026-09-01",
  final_date: null,
  arrest_days: 10,
  executed_on: null,
  informed_at: null,
  informed_by: null,
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

describe("validarea executării", () => {
  it("executarea e opțională", () => {
    expect(validateContravener({ ...bun, executed_on: "" }, "2026-09-29")).toBeNull();
  });

  it("nu înainte de hotărâre", () => {
    expect(
      validateContravener({ ...bun, decision_date: "2026-09-10", executed_on: "2026-09-09" }),
    ).toMatch(/înainte de data hotărârii/);
  });

  it("nu în viitor, față de ziua dată de server", () => {
    // Altfel avertizarea s-ar stinge de pe acum pentru un om care n-a venit.
    expect(validateContravener({ ...bun, executed_on: "2026-09-30" }, "2026-09-29")).toMatch(
      /viitor/,
    );
    expect(validateContravener({ ...bun, executed_on: "2026-09-29" }, "2026-09-29")).toBeNull();
  });

  it("o zi care nu există e respinsă", () => {
    expect(validateContravener({ ...bun, executed_on: "2026-02-30" })).toMatch(/nu e o zi/);
  });
});

describe("termenul de executare", () => {
  it("ultima zi e aceeași zi, peste un an", () => {
    expect(ultimaZiDeExecutare("2026-09-25")).toBe("2027-09-25");
  });

  it("29 februarie trece în 28 februarie, nu în 1 martie", () => {
    // 1 martie ar lungi termenul peste un an.
    expect(ultimaZiDeExecutare("2028-02-29")).toBe("2029-02-28");
  });

  it("fără dată definitivă termenul nu se poate socoti", () => {
    expect(prescriptieOf(c({ id: "1", final_date: null }), "2026-09-29").stare).toBe("fara_data");
  });

  it("departe de termen — în termen, cu zilele rămase", () => {
    const p = prescriptieOf(c({ id: "1", final_date: "2026-09-25" }), "2026-09-29");
    expect(p).toEqual({ stare: "in_termen", ultimaZi: "2027-09-25", zileRamase: 361 });
  });

  it("avertizarea se aprinde cu exact AVERTIZARE_ZILE zile înainte", () => {
    const final = "2026-09-25"; // ultima zi: 2027-09-25
    // 26 august 2027: 30 de zile rămase — avertizare.
    expect(prescriptieOf(c({ id: "1", final_date: final }), "2027-08-26").stare).toBe(
      "expira_curand",
    );
    // 25 august 2027: 31 de zile rămase — încă în termen.
    expect(prescriptieOf(c({ id: "1", final_date: final }), "2027-08-25").stare).toBe("in_termen");
    expect(AVERTIZARE_ZILE).toBe(30);
  });

  it("în ultima zi încă se poate executa: 0 zile rămase, nu prescris", () => {
    const p = prescriptieOf(c({ id: "1", final_date: "2026-09-25" }), "2027-09-25");
    expect(p).toEqual({ stare: "expira_curand", ultimaZi: "2027-09-25", zileRamase: 0 });
  });

  it("a doua zi e prescris, din ziua aceea", () => {
    const p = prescriptieOf(c({ id: "1", final_date: "2026-09-25" }), "2027-09-26");
    expect(p).toEqual({ stare: "prescris", prescrisDin: "2027-09-26", informatLa: null });
  });

  it("arestul executat nu mai are termen, oricât ar fi trecut", () => {
    // Fără bifa asta, după un an s-ar fi aprins avertizarea și la cei care
    // și-au ispășit demult zilele.
    const p = prescriptieOf(
      c({ id: "1", final_date: "2025-01-10", executed_on: "2025-01-12" }),
      "2026-09-29",
    );
    expect(p).toEqual({ stare: "executat", executatLa: "2025-01-12" });
  });

  it("informarea trimisă se vede pe cea prescrisă", () => {
    const p = prescriptieOf(
      c({ id: "1", final_date: "2025-01-10", informed_at: "2026-01-12T08:00:00+00:00" }),
      "2026-09-29",
    );
    expect(p.stare === "prescris" && p.informatLa).toBe("2026-01-12T08:00:00+00:00");
  });
});

describe("ce e de informat", () => {
  const azi = "2026-09-29";
  const rows = [
    // Prescrisă, fără informare — de informat.
    c({ id: "de", final_date: "2025-01-10" }),
    // Prescrisă, cu informare — rezolvată.
    c({ id: "gata", final_date: "2025-02-10", informed_at: "2026-02-12T08:00:00+00:00" }),
    // Veche, dar executată — nimic de făcut.
    c({ id: "exec", final_date: "2025-01-10", executed_on: "2025-01-15" }),
    // Expiră în 10 zile.
    c({ id: "curand", final_date: "2025-10-09" }),
    // Proaspătă.
    c({ id: "nou", final_date: "2026-09-20" }),
    // Fără dată definitivă.
    c({ id: "fara", final_date: null }),
  ];

  it("de informat e doar cea prescrisă și neinformată", () => {
    expect(rows.filter((r) => deInformat(r, azi)).map((r) => r.id)).toEqual(["de"]);
  });

  it("filtrele aleg ce spun", () => {
    expect(filterContraveners(rows, "toti", azi)).toHaveLength(rows.length);
    expect(filterContraveners(rows, "de_informat", azi).map((r) => r.id)).toEqual(["de"]);
    expect(filterContraveners(rows, "expira_curand", azi).map((r) => r.id)).toEqual(["curand"]);
  });

  it("numărătoarea se potrivește cu filtrele", () => {
    // Cifra din pastilă trebuie să fie chiar câte rânduri arată pastila.
    const n = countPrescriptie(rows, azi);
    expect(n.deInformat).toBe(filterContraveners(rows, "de_informat", azi).length);
    expect(n.expiraCurand).toBe(filterContraveners(rows, "expira_curand", azi).length);
  });
});
