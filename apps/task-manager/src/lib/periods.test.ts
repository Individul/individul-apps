import { describe, it, expect } from "vitest";
import { rangeForPeriod, toISODate } from "./periods";

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
