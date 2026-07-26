import { describe, it, expect } from "vitest";
import { recipientsFor, messageFor } from "./notifications";

const T = { assignee_id: "a" as string | null, created_by: "c" };

describe("recipientsFor", () => {
  it("assigned: doar noul responsabil, dacă nu e actorul", () => {
    expect(recipientsFor("assigned", { assignee_id: "a", created_by: "c" }, "c")).toEqual(["a"]);
  });
  it("assigned: gol dacă responsabilul e chiar actorul", () => {
    expect(recipientsFor("assigned", { assignee_id: "a", created_by: "c" }, "a")).toEqual([]);
  });
  it("assigned: gol dacă nu există responsabil", () => {
    expect(recipientsFor("assigned", { assignee_id: null, created_by: "c" }, "c")).toEqual([]);
  });
  it("comment/status/edited: responsabil + creator, fără actor, dedublați", () => {
    expect(recipientsFor("comment", T, "x").sort()).toEqual(["a", "c"]);
    expect(recipientsFor("status", T, "a")).toEqual(["c"]);
    expect(recipientsFor("edited", { assignee_id: "c", created_by: "c" }, "x")).toEqual(["c"]);
  });
  it("gol dacă singurul vizat e actorul", () => {
    expect(recipientsFor("edited", { assignee_id: null, created_by: "c" }, "c")).toEqual([]);
  });
});

describe("messageFor", () => {
  it("formulează mesaje în română cu titlul", () => {
    expect(messageFor("assigned", "Raport")).toContain("Raport");
    expect(messageFor("comment", "Raport")).toContain("Raport");
    expect(messageFor("status", "Raport", "Finalizat")).toContain("Finalizat");
  });
});
