import { describe, it, expect } from "vitest";
import { filterTasks, sortByPriority, PRIORITY_ORDER } from "./task-filters";
import type { Task } from "./types";

const t = (over: Partial<Task>): Task => ({
  id: "1", title: "x", description: null, status: "todo", priority: "medium",
  due_date: null, assignee_id: null, created_by: "u", created_at: "", updated_at: "", ...over,
});

describe("filterTasks", () => {
  it("filtrează după status", () => {
    const tasks = [t({ id: "a", status: "todo" }), t({ id: "b", status: "done" })];
    expect(filterTasks(tasks, { status: "done" }).map(x => x.id)).toEqual(["b"]);
  });
  it("filtrează după assignee", () => {
    const tasks = [t({ id: "a", assignee_id: "u1" }), t({ id: "b", assignee_id: "u2" })];
    expect(filterTasks(tasks, { assigneeId: "u1" }).map(x => x.id)).toEqual(["a"]);
  });
  it("filtrează după prioritate", () => {
    const tasks = [t({ id: "a", priority: "low" }), t({ id: "b", priority: "high" })];
    expect(filterTasks(tasks, { priority: "high" }).map(x => x.id)).toEqual(["b"]);
  });
  it("combină filtrele (AND)", () => {
    const tasks = [
      t({ id: "a", status: "todo", assignee_id: "u1" }),
      t({ id: "b", status: "todo", assignee_id: "u2" }),
      t({ id: "c", status: "done", assignee_id: "u1" }),
    ];
    expect(filterTasks(tasks, { status: "todo", assigneeId: "u1" }).map(x => x.id)).toEqual(["a"]);
  });
  it("fără filtre întoarce tot", () => {
    const tasks = [t({ id: "a" }), t({ id: "b" })];
    expect(filterTasks(tasks, {})).toHaveLength(2);
  });
});

describe("sortByPriority", () => {
  it("high înaintea medium înaintea low", () => {
    const tasks = [t({ id: "a", priority: "low" }), t({ id: "b", priority: "high" }), t({ id: "c", priority: "medium" })];
    expect(sortByPriority(tasks).map(x => x.id)).toEqual(["b", "c", "a"]);
  });
  it("nu mutează array-ul original", () => {
    const tasks = [t({ id: "a", priority: "low" }), t({ id: "b", priority: "high" })];
    const copy = [...tasks];
    sortByPriority(tasks);
    expect(tasks.map(x => x.id)).toEqual(copy.map(x => x.id));
  });
});
