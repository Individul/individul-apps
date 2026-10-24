import { describe, expect, it } from "vitest";

import { caleDecodabila } from "./middleware";

describe("adresele cu „%” greșit", () => {
  it("o cale obișnuită sau codată corect trece", () => {
    expect(caleDecodabila("/sarcini")).toBe(true);
    expect(caleDecodabila("/fisiere/abc/M-535-26-%C8%98tefan.pdf")).toBe(true);
  });

  it("un „%” fără cele două cifre nu trece", () => {
    expect(caleDecodabila("/fisiere/abc/%E0%A4%A.pdf")).toBe(false);
    expect(caleDecodabila("/sarcini/100%")).toBe(false);
  });
});
