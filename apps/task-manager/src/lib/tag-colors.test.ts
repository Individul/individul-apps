import { describe, expect, it } from "vitest";

import { contrast, culoarePeAlb, textPeCuloare } from "@/lib/tag-colors";

// Culorile etichetelor din baza de producție, la 29.10.2026.
const INCHISE = ["#0467f1", "#b91c1c", "#6d28d9", "#475569", "#0f766e", "#a21caf", "#4d7c0f", "#64748b"];
const DESCHISE = ["#13d83a", "#17b5a2"];

describe("textul de pe etichete", () => {
  it("contrastul se calculează ca în WCAG", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("etichetele închise își păstrează textul alb", () => {
    for (const c of INCHISE) expect(textPeCuloare(c)).toBe("#ffffff");
  });

  it("pe cele deschise textul devine închis și se citește", () => {
    for (const c of DESCHISE) {
      expect(textPeCuloare(c)).toBe("#1a1b1e");
      expect(contrast(c, textPeCuloare(c))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("pe contur, culoarea se închide doar cât trebuie", () => {
    expect(culoarePeAlb("#b91c1c")).toBe("#b91c1c");
    for (const c of [...INCHISE, ...DESCHISE]) {
      expect(contrast(culoarePeAlb(c), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
    expect(culoarePeAlb("#13d83a")).not.toBe("#13d83a");
  });

  it("o valoare stricată nu dă text invizibil", () => {
    expect(culoarePeAlb("rosu")).toBe("#1a1b1e");
  });
});
