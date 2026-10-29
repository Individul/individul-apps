import { describe, expect, it } from "vitest";

import { termenSarcina } from "@/lib/task-termen";

const azi = new Date(2026, 9, 29); // 29 octombrie 2026

describe("banda unei sarcini, după termen", () => {
  it("termenul trecut e restant, cel din 7 zile e scadent", () => {
    expect(termenSarcina({ status: "todo", due_date: "2026-10-28" }, azi).stare).toBe("restant");
    expect(termenSarcina({ status: "in_progress", due_date: "2026-11-05" }, azi).stare).toBe("scadent");
    expect(termenSarcina({ status: "todo", due_date: "2026-11-20" }, azi).stare).toBe("inTermen");
  });

  it("finalizata e gata, oricare ar fi termenul", () => {
    expect(termenSarcina({ status: "done", due_date: "2026-01-01" }, azi).stare).toBe("gata");
  });

  it("în așteptare termenul e oprit: nici restantă, nici scadentă", () => {
    const t = termenSarcina({ status: "waiting", due_date: "2026-10-01" }, azi);
    expect(t.stare).toBe("inTermen");
    expect(t.eticheta).toMatch(/oprit/);
  });

  it("fără termen spune asta", () => {
    expect(termenSarcina({ status: "todo", due_date: null }, azi).eticheta).toBe("Fără termen");
  });
});
