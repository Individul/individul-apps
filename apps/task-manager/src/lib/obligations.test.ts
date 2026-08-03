import { describe, expect, it } from "vitest";
import {
  lastDue,
  needsAttention,
  nextDue,
  pendingFor,
  sortPending,
  type Obligation,
} from "./obligations";
import { toISODate } from "./periods";

const o = (over: Partial<Obligation>): Obligation => ({
  id: "1", title: "x", recipient: "ANP", kind: "lunar_zi", day_of_month: 20,
  weekday: null, assignee_id: null, active: true, position: 0,
  created_at: "", updated_at: "", ...over,
});

const ZI_20 = o({ id: "zpm", day_of_month: 20 });
const ZI_30 = o({ id: "demersuri", day_of_month: 30 });
const ULTIMA = o({ id: "lunara", kind: "lunar_ultima_zi", day_of_month: null });
const VINERI = o({ id: "saptamanala", kind: "saptamanal", day_of_month: null, weekday: 5 });

describe("termenul lunar la zi fixă", () => {
  it("ziua cerută, când există", () => {
    expect(toISODate(nextDue(ZI_20, new Date(2026, 7, 1)))).toBe("2026-08-20");
  });

  it("„data de 30” în februarie cade pe ultima zi, nu în martie", () => {
    // Capcana: `new Date(2026, 1, 30)` alunecă în martie, adică termenul s-ar
    // muta cu două zile mai târziu exact în luna în care e cel mai strâns.
    expect(toISODate(nextDue(ZI_30, new Date(2026, 1, 1)))).toBe("2026-02-28");
  });

  it("în an bisect, februarie are 29", () => {
    expect(toISODate(nextDue(ZI_30, new Date(2028, 1, 1)))).toBe("2028-02-29");
  });

  it("după ce ziua a trecut, urmează luna viitoare", () => {
    expect(toISODate(nextDue(ZI_20, new Date(2026, 7, 21)))).toBe("2026-09-20");
  });

  it("chiar în ziua termenului, el încă n-a trecut", () => {
    expect(toISODate(lastDue(ZI_20, new Date(2026, 7, 20)))).toBe("2026-08-20");
  });
});

describe("termenul în ultima zi a lunii", () => {
  it("nu e „31”: fiecare lună are ultima ei zi", () => {
    expect(toISODate(nextDue(ULTIMA, new Date(2026, 3, 1)))).toBe("2026-04-30");
    expect(toISODate(nextDue(ULTIMA, new Date(2026, 1, 1)))).toBe("2026-02-28");
    expect(toISODate(nextDue(ULTIMA, new Date(2026, 0, 1)))).toBe("2026-01-31");
  });
});

describe("termenul săptămânal", () => {
  it("vinerea din săptămâna curentă", () => {
    // 3 august 2026 e luni.
    expect(toISODate(nextDue(VINERI, new Date(2026, 7, 3)))).toBe("2026-08-07");
  });

  it("sâmbăta, următorul e vinerea viitoare", () => {
    expect(toISODate(nextDue(VINERI, new Date(2026, 7, 8)))).toBe("2026-08-14");
  });

  it("cel mai recent termen trecut, văzut sâmbăta", () => {
    expect(toISODate(lastDue(VINERI, new Date(2026, 7, 8)))).toBe("2026-08-07");
  });
});

describe("pendingFor", () => {
  it("termenul trecut și nebifat rămâne cel care contează", () => {
    // Restanța nu dispare pentru că a venit luna următoare.
    const p = pendingFor(ZI_20, new Set(), new Date(2026, 7, 25));
    expect(p.due).toBe("2026-08-20");
    expect(p.overdue).toBe(true);
    expect(p.days).toBe(-5);
  });

  it("bifat → se trece la termenul următor", () => {
    const p = pendingFor(ZI_20, new Set(["2026-08-20"]), new Date(2026, 7, 25));
    expect(p.due).toBe("2026-09-20");
    expect(p.overdue).toBe(false);
  });

  it("înainte de termen, arată termenul apropiat", () => {
    const p = pendingFor(ZI_20, new Set(["2026-07-20"]), new Date(2026, 7, 17));
    expect(p.due).toBe("2026-08-20");
    expect(p.days).toBe(3);
  });

  it("se privește în urmă o singură apariție", () => {
    // O dare de seamă nebifată acum șase luni nu mai e o acțiune de făcut;
    // ținută la vedere, ar împinge afară termenul de acum.
    const p = pendingFor(ZI_20, new Set(), new Date(2026, 7, 10));
    expect(p.due).toBe("2026-07-20");
  });
});

describe("ce se arată la vedere", () => {
  it("restanța se arată întotdeauna", () => {
    expect(needsAttention(pendingFor(ZI_20, new Set(), new Date(2026, 7, 25)))).toBe(true);
  });

  it("lunara tace până la cinci zile înainte", () => {
    expect(needsAttention(pendingFor(ZI_20, new Set(["2026-07-20"]), new Date(2026, 7, 14)))).toBe(
      false,
    );
    expect(needsAttention(pendingFor(ZI_20, new Set(["2026-07-20"]), new Date(2026, 7, 15)))).toBe(
      true,
    );
  });

  it("săptămânala nu stă pe ecran toată săptămâna", () => {
    // Cu preavizul lunar, o obligație de vineri ar fi vizibilă zilnic, iar o
    // bandă permanentă se citește la fel de puțin ca nimic.
    const luni = new Date(2026, 7, 3);
    expect(needsAttention(pendingFor(VINERI, new Set(["2026-07-31"]), luni))).toBe(false);
    const miercuri = new Date(2026, 7, 5);
    expect(needsAttention(pendingFor(VINERI, new Set(["2026-07-31"]), miercuri))).toBe(true);
  });
});

describe("sortPending", () => {
  it("restanțele primele, apoi după termen", () => {
    const azi = new Date(2026, 7, 25);
    const items = [
      // Bifat pe 30 iulie, deci termenul lui e 30 august — încă în viitor.
      pendingFor(ZI_30, new Set(["2026-07-30"]), azi),
      pendingFor(ZI_20, new Set(), azi), // 20 august, restant
    ];
    expect(sortPending(items).map((p) => p.obligation.id)).toEqual(["zpm", "demersuri"]);
  });
});
