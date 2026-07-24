import { describe, it, expect } from "vitest";
import { canEditComment } from "./permissions";

describe("canEditComment", () => {
  it("autorul poate edita", () => expect(canEditComment("u1", { author_id: "u1" })).toBe(true));
  it("alt user nu poate", () => expect(canEditComment("u2", { author_id: "u1" })).toBe(false));
});
