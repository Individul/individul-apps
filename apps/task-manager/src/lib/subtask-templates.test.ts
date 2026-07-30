import { describe, it, expect } from "vitest";
import { isDispatchStep, isResponseStep, templateStepsForTags } from "./subtask-templates";

describe("isDispatchStep", () => {
  it("prinde pașii de expediere din ambele șabloane", () => {
    expect(isDispatchStep("Demers expediat la instanță")).toBe(true);
    expect(isDispatchStep("Solicitare expediată")).toBe(true);
  });
  it("nu prinde pașii de pregătire", () => {
    expect(isDispatchStep("Demers întocmit")).toBe(false);
  });
});

describe("isResponseStep", () => {
  it("prinde pașii prin care răspunsul a sosit", () => {
    expect(isResponseStep("Demers examinat de instanță")).toBe(true);
    expect(isResponseStep("Hotărâre primită")).toBe(true);
  });
  it("nu prinde expedierea — altfel sarcina s-ar închide la trimitere", () => {
    expect(isResponseStep("Demers expediat la instanță")).toBe(false);
    expect(isResponseStep("Solicitare expediată")).toBe(false);
  });
  it("nu prinde pașii de pregătire", () => {
    expect(isResponseStep("Demers întocmit")).toBe(false);
    expect(isResponseStep("Solicitare întocmită")).toBe(false);
  });
  it("tolerează diacriticele și majusculele", () => {
    expect(isResponseStep("HOTĂRÎRE PRIMITĂ")).toBe(true);
  });
});

describe("cele două reguli nu se suprapun", () => {
  it("niciun pas din șabloane nu e și expediere, și răspuns", () => {
    const steps = templateStepsForTags(["cumulare", "solicitare hotariri"]);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(isDispatchStep(step) && isResponseStep(step)).toBe(false);
    }
  });
});
