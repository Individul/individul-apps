import { describe, expect, it } from "vitest";
import { reportWeek, shiftWeek } from "./weekly-report";
import { toISODate } from "./periods";

const iso = (r: { from: Date; to: Date }) => [toISODate(r.from), toISODate(r.to)];

describe("săptămâna raportului", () => {
  it("marți arată săptămâna tocmai încheiată, nu ziua curentă", () => {
    // 4 august 2026 e marți. Raportul de azi acoperă 28 iulie → 3 august.
    // Marțea curentă intră în raportul de săptămâna viitoare.
    expect(iso(reportWeek(new Date(2026, 7, 4)))).toEqual(["2026-07-28", "2026-08-03"]);
  });

  it("miercuri arată aceeași săptămână ca marți", () => {
    // Raportul nu se schimbă sub mână în cursul săptămânii.
    expect(iso(reportWeek(new Date(2026, 7, 5)))).toEqual(["2026-07-28", "2026-08-03"]);
  });

  it("luni arată tot săptămâna de dinainte: ziua de azi nu s-a încheiat", () => {
    // 10 august e luni. Săptămâna 4→10 august nu e completă până la miezul
    // nopții, deci raportul rămâne pe cea dinainte.
    expect(iso(reportWeek(new Date(2026, 7, 10)))).toEqual(["2026-07-28", "2026-08-03"]);
  });

  it("marțea următoare avansează exact cu șapte zile", () => {
    expect(iso(reportWeek(new Date(2026, 7, 11)))).toEqual(["2026-08-04", "2026-08-10"]);
  });

  it("intervalul are întotdeauna șapte zile", () => {
    for (let d = 1; d <= 31; d++) {
      const w = reportWeek(new Date(2026, 6, d));
      const zile = Math.round((w.to.getTime() - w.from.getTime()) / 86_400_000) + 1;
      expect(zile).toBe(7);
    }
  });

  it("începe marți și se termină luni, în orice zi ai deschide", () => {
    for (let d = 1; d <= 31; d++) {
      const w = reportWeek(new Date(2026, 6, d));
      expect(w.from.getDay()).toBe(2); // marți
      expect(w.to.getDay()).toBe(1); // luni
    }
  });

  it("navigarea nu sare și nu suprapune", () => {
    const acum = reportWeek(new Date(2026, 7, 4));
    const inainte = shiftWeek(acum, -1);
    expect(iso(inainte)).toEqual(["2026-07-21", "2026-07-27"]);
    expect(toISODate(acum.from)).toBe("2026-07-28");
    expect(iso(shiftWeek(inainte, 1))).toEqual(iso(acum));
  });

  it("trece peste marginea de an fără să se rupă", () => {
    const w = reportWeek(new Date(2027, 0, 5)); // 5 ian 2027, marți
    expect(iso(w)).toEqual(["2026-12-29", "2027-01-04"]);
  });
});
