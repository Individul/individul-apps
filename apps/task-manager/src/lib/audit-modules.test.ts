import { describe, it, expect } from "vitest";
import { AUDIT_MODULES, entitiesFor, readAuditModule } from "./audit-modules";
import type { AuditEntry } from "./types";

// Toate entitățile pe care le scrie trigger-ul de audit.
const ALL_ENTITIES: AuditEntry["entity"][] = [
  "tasks",
  "subtasks",
  "comments",
  "tags",
  "task_tags",
  "petitions",
  "petition_attachments",
  "hearings",
  "profiles",
];

describe("AUDIT_MODULES", () => {
  it("fiecare entitate aparține exact unui modul", () => {
    // Garda care contează: o entitate nouă, uitată la mapare, ar dispărea din
    // toate taburile în afară de „Toate" — fără niciun semn că lipsește.
    for (const entity of ALL_ENTITIES) {
      const owners = AUDIT_MODULES.filter(
        (m) => m.value !== "toate" && m.entities.includes(entity),
      );
      expect(owners.map((o) => o.value)).toHaveLength(1);
    }
  });

  it("niciun modul nu revendică o entitate inexistentă", () => {
    for (const m of AUDIT_MODULES) {
      for (const entity of m.entities) expect(ALL_ENTITIES).toContain(entity);
    }
  });

  it("„Toate” nu filtrează nimic", () => {
    expect(entitiesFor("toate")).toEqual([]);
  });
});

describe("readAuditModule", () => {
  it("acceptă valorile cunoscute", () => {
    expect(readAuditModule("petitii")).toBe("petitii");
    expect(readAuditModule("sedinte")).toBe("sedinte");
  });
  it("cade pe „toate” la valori lipsă sau inventate", () => {
    expect(readAuditModule(undefined)).toBe("toate");
    expect(readAuditModule("altceva")).toBe("toate");
  });
});
