import { describe, expect, it } from "vitest";

import { dataPlanului } from "@/components/transfers/plan-format";
import type { TransferPlan } from "@/lib/transfer-plans";

const baza = {
  hearing_date: "2026-11-04",
  decision_date: "2026-10-20",
  ruling_date: "2026-10-12",
} as unknown as TransferPlan;

describe("dataPlanului", () => {
  it("spune temeiul cu numele din formular", () => {
    expect(dataPlanului({ ...baza, basis: "sedinta" })).toBe("ședință, 4 noi 2026");
    expect(dataPlanului({ ...baza, basis: "decizie" })).toBe("decizie, 20 oct 2026");
    expect(dataPlanului({ ...baza, basis: "termen30" })).toBe("30 zile, 12 oct 2026");
  });

  it("fără dată, o liniuță", () => {
    expect(dataPlanului({ ...baza, basis: "termen30", ruling_date: null })).toBe("—");
  });
});
