import { describe, it, expect } from "vitest";
import {
  aggregate,
  computeIndicators,
  rangeForPeriod,
  toISODate,
  type HearingCounts,
} from "./hearings";

const c = (over: Partial<HearingCounts> = {}): HearingCounts => ({
  tc_petrecute: 0, tc_amanate: 0, ij_petrecute: 0, ij_amanate: 0, ...over,
});

describe("computeIndicators", () => {
  it("totalul pe categorie e petrecute + amânate", () => {
    const i = computeIndicators(c({ tc_petrecute: 5, tc_amanate: 2 }));
    expect(i.tc_total).toBe(7);
  });
  it("totalul general adună cele două categorii", () => {
    const i = computeIndicators(
      c({ tc_petrecute: 5, tc_amanate: 2, ij_petrecute: 8, ij_amanate: 1 }),
    );
    expect(i.tc_total).toBe(7);
    expect(i.ij_total).toBe(9);
    expect(i.total).toBe(16);
  });
  it("petrecute și amânate se însumează peste categorii", () => {
    const i = computeIndicators(
      c({ tc_petrecute: 5, tc_amanate: 2, ij_petrecute: 8, ij_amanate: 1 }),
    );
    expect(i.petrecute).toBe(13);
    expect(i.amanate).toBe(3);
    expect(i.petrecute + i.amanate).toBe(i.total);
  });
  it("zi goală", () => {
    expect(computeIndicators(c()).total).toBe(0);
  });
});

describe("aggregate", () => {
  it("adună mai multe zile", () => {
    const i = aggregate([
      c({ tc_petrecute: 3, ij_amanate: 1 }),
      c({ tc_petrecute: 2, ij_petrecute: 4 }),
    ]);
    expect(i.tc_petrecute).toBe(5);
    expect(i.ij_petrecute).toBe(4);
    expect(i.ij_amanate).toBe(1);
    expect(i.total).toBe(10);
  });
  it("suma zilelor e egală cu totalul perioadei", () => {
    // Proprietatea care face raportul credibil: perioada nu poate spune altceva
    // decât zilele din care e compusă.
    const days = [
      c({ tc_petrecute: 3, tc_amanate: 1, ij_petrecute: 2, ij_amanate: 4 }),
      c({ tc_petrecute: 7, tc_amanate: 0, ij_petrecute: 5, ij_amanate: 2 }),
      c({ tc_petrecute: 1, tc_amanate: 6, ij_petrecute: 0, ij_amanate: 3 }),
    ];
    const perioada = aggregate(days);
    const sumaZilelor = days.reduce((n, d) => n + computeIndicators(d).total, 0);
    expect(perioada.total).toBe(sumaZilelor);
  });
  it("listă goală", () => {
    expect(aggregate([]).total).toBe(0);
  });
});

describe("rangeForPeriod", () => {
  const ref = new Date(2026, 6, 30); // joi, 30 iulie 2026

  it("ziua", () => {
    const r = rangeForPeriod("zi", ref);
    expect(toISODate(r.from)).toBe("2026-07-30");
    expect(toISODate(r.to)).toBe("2026-07-30");
  });
  it("săptămâna începe luni", () => {
    const r = rangeForPeriod("saptamana", ref);
    expect(toISODate(r.from)).toBe("2026-07-27");
    expect(toISODate(r.to)).toBe("2026-08-02");
  });
  it("luna", () => {
    const r = rangeForPeriod("luna", ref);
    expect(toISODate(r.from)).toBe("2026-07-01");
    expect(toISODate(r.to)).toBe("2026-07-31");
  });
  it("trimestrul", () => {
    const r = rangeForPeriod("trimestru", ref);
    expect(toISODate(r.from)).toBe("2026-07-01");
    expect(toISODate(r.to)).toBe("2026-09-30");
  });
  it("semestrul al doilea", () => {
    const r = rangeForPeriod("semestru", ref);
    expect(toISODate(r.from)).toBe("2026-07-01");
    expect(toISODate(r.to)).toBe("2026-12-31");
  });
  it("semestrul întâi", () => {
    const r = rangeForPeriod("semestru", new Date(2026, 2, 15));
    expect(toISODate(r.from)).toBe("2026-01-01");
    expect(toISODate(r.to)).toBe("2026-06-30");
  });
  it("anul", () => {
    const r = rangeForPeriod("an", ref);
    expect(toISODate(r.from)).toBe("2026-01-01");
    expect(toISODate(r.to)).toBe("2026-12-31");
  });
});
