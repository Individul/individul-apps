import { describe, it, expect } from "vitest";
import {
  canEditComment,
  canDeleteComment,
  canDeleteTask,
  canEditTask,
  canFinalizeTask,
  canReassignTask,
} from "./permissions";

describe("canEditComment", () => {
  it("autorul poate edita", () => expect(canEditComment("u1", { author_id: "u1" })).toBe(true));
  it("alt user nu poate", () => expect(canEditComment("u2", { author_id: "u1" })).toBe(false));
});

const task = (over: Partial<{ created_by: string; assignee_id: string | null }>) => ({
  created_by: "owner",
  assignee_id: null as string | null,
  ...over,
});

describe("canDeleteTask", () => {
  it("adminul poate șterge orice", () => expect(canDeleteTask("x", true, task({}))).toBe(true));
  it("creatorul poate șterge", () => expect(canDeleteTask("owner", false, task({}))).toBe(true));
  it("altcineva nu poate", () => expect(canDeleteTask("other", false, task({}))).toBe(false));
  it("asignatul (dar nu creator) nu poate șterge", () =>
    expect(canDeleteTask("a", false, task({ assignee_id: "a" }))).toBe(false));
});

describe("canEditTask", () => {
  it("adminul poate edita orice", () => expect(canEditTask("x", true, task({}))).toBe(true));
  it("creatorul poate edita", () => expect(canEditTask("owner", false, task({}))).toBe(true));
  it("asignatul poate edita", () =>
    expect(canEditTask("a", false, task({ assignee_id: "a" }))).toBe(true));
  it("altcineva nu poate", () => expect(canEditTask("other", false, task({}))).toBe(false));
});

describe("canFinalizeTask", () => {
  it("adminul poate finaliza orice", () =>
    expect(canFinalizeTask("x", true, task({}))).toBe(true));
  it("creatorul poate finaliza", () =>
    expect(canFinalizeTask("owner", false, task({}))).toBe(true));
  it("asignatul poate finaliza", () =>
    expect(canFinalizeTask("a", false, task({ assignee_id: "a" }))).toBe(true));
  it("altcineva nu poate finaliza", () =>
    expect(canFinalizeTask("other", false, task({}))).toBe(false));
});

describe("canReassignTask", () => {
  it("doar adminul poate reatribui", () => {
    expect(canReassignTask(true)).toBe(true);
    expect(canReassignTask(false)).toBe(false);
  });
});

describe("canDeleteComment", () => {
  it("autorul poate", () => expect(canDeleteComment("u1", false, { author_id: "u1" })).toBe(true));
  it("adminul poate șterge al oricui", () =>
    expect(canDeleteComment("u2", true, { author_id: "u1" })).toBe(true));
  it("alt user non-admin nu poate", () =>
    expect(canDeleteComment("u2", false, { author_id: "u1" })).toBe(false));
});
