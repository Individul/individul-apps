import { describe, expect, it } from "vitest";

import { cautaInJurnal, frazaJurnal } from "@/lib/audit-text";
import type { AuditEntry } from "@/lib/types";

function intrare(p: Partial<AuditEntry>): AuditEntry {
  return {
    id: Math.random().toString(36).slice(2),
    actor_id: "u1",
    actor_name: "Dumitru Prisăcaru",
    action: "UPDATE",
    entity: "transfer_plans",
    entity_id: "x",
    details: {},
    created_at: "2026-10-28T09:00:00.000Z",
    ...p,
  } as AuditEntry;
}

const JURNAL: AuditEntry[] = [
  intrare({ entity: "transfer_plans", details: { name: "Roșca Daniel", hearing_from: "2026-11-03", hearing_to: "2026-11-05" } }),
  intrare({ entity: "transfer_plans", action: "INSERT", details: { name: "Rojcovoi Serghei" }, created_at: "2026-10-22T09:00:00.000Z" }),
  intrare({ entity: "petitions", action: "INSERT", actor_name: "Natalia Spinei", details: { number: "P-672/26" } }),
  intrare({ entity: "tasks", action: "INSERT", actor_name: null, details: { title: "Verificare dosar Ţurcanu" } }),
  intrare({ entity: "petitions", action: "INSERT", details: { number: "P-22/26" } }),
];

describe("căutarea în jurnal", () => {
  it("caută în fraza afișată, fără diacritice și fără majuscule", () => {
    const g = cautaInJurnal(JURNAL, "rosca");
    expect(g).toHaveLength(1);
    expect(frazaJurnal(g[0])).toMatch(/Roșca Daniel/);
  });

  it("mai multe cuvinte trebuie să apară toate, în orice ordine", () => {
    expect(cautaInJurnal(JURNAL, "sedinta rosca")).toHaveLength(1);
    expect(cautaInJurnal(JURNAL, "rosca petitia")).toHaveLength(0);
  });

  it("găsește după cine a făcut-o, inclusiv „Sistem”", () => {
    expect(cautaInJurnal(JURNAL, "spinei").map((e) => e.entity)).toEqual(["petitions"]);
    expect(cautaInJurnal(JURNAL, "sistem").map((e) => e.entity)).toEqual(["tasks"]);
  });

  it("găsește după zi, scrisă ca în listă", () => {
    expect(cautaInJurnal(JURNAL, "22 octombrie")).toHaveLength(1);
  });

  it("un număr se potrivește întreg: „20” nu prinde „2026”", () => {
    expect(cautaInJurnal(JURNAL, "20 octombrie")).toHaveLength(0);
    expect(cautaInJurnal(JURNAL, "672")).toHaveLength(1);
  });

  it("expresia exactă are întâietate: „22 octombrie” e ziua, nu petiția P-22/26", () => {
    const g = cautaInJurnal(JURNAL, "22 octombrie");
    expect(g).toEqual([JURNAL[1]]);
    // Fără expresie exactă, cuvintele în orice ordine.
    expect(cautaInJurnal(JURNAL, "octombrie p-22")).toEqual([JURNAL[4]]);
  });

  it("găsește numărul petiției și ț cu sedilă", () => {
    expect(cautaInJurnal(JURNAL, "p-672")).toHaveLength(1);
    expect(cautaInJurnal(JURNAL, "turcanu")).toHaveLength(1);
  });

  it("se oprește la limită, păstrând ordinea", () => {
    expect(cautaInJurnal(JURNAL, "dumitru", 1)).toEqual([JURNAL[0]]);
  });

  it("fără text întoarce primele intrări", () => {
    expect(cautaInJurnal(JURNAL, "  ", 2)).toEqual(JURNAL.slice(0, 2));
  });
});
