import { describe, it, expect } from "vitest";
import { taskStats, petitionStats } from "./hub-stats";
import type { Task, Petition } from "./types";

const t = (over: Partial<Task>): Task => ({
  id: "1", title: "x", description: null, status: "todo", priority: "medium",
  due_date: null, assignee_id: null, created_by: "u", created_at: "", updated_at: "", ...over,
});

const p = (over: Partial<Petition>): Petition => ({
  id: "1", number: "1", petitioner: "x", petitioner_type: "detinut", subject: null,
  received_date: "2026-07-01", response_deadline: null, status: "in_examinare",
  response: null, response_date: null, assignee_id: null, created_by: "u",
  created_at: "", updated_at: "", ...over,
});

const today = new Date(2026, 6, 28); // 28 iul 2026

describe("taskStats", () => {
  it("numără total și active (nefinalizate)", () => {
    const s = taskStats([t({}), t({ status: "in_progress" }), t({ status: "done" })], today);
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
  });
  it("numără restante (termen trecut, nefinalizate)", () => {
    const s = taskStats([
      t({ due_date: "2026-07-20" }),
      t({ due_date: "2026-07-20", status: "done" }),
      t({ due_date: "2026-08-10" }),
    ], today);
    expect(s.overdue).toBe(1);
  });
  it("numără scadente în 7 zile (azi inclusiv, fără restante)", () => {
    const s = taskStats([
      t({ due_date: "2026-07-28" }),
      t({ due_date: "2026-08-04" }),
      t({ due_date: "2026-08-05" }),
      t({ due_date: "2026-07-20" }),
    ], today);
    expect(s.dueSoon).toBe(2);
  });
  it("listă goală", () => {
    expect(taskStats([], today)).toEqual({ total: 0, active: 0, dueSoon: 0, overdue: 0 });
  });
});

describe("petitionStats", () => {
  it("numără total și în examinare", () => {
    const s = petitionStats([p({}), p({ status: "solutionat" })], today);
    expect(s.total).toBe(2);
    expect(s.open).toBe(1);
  });
  it("numără restante și scadente în 7 zile (doar cele în examinare)", () => {
    const s = petitionStats([
      p({ response_deadline: "2026-07-20" }),
      p({ response_deadline: "2026-07-20", status: "solutionat" }),
      p({ response_deadline: "2026-07-30" }),
      p({ response_deadline: "2026-09-01" }),
    ], today);
    expect(s.overdue).toBe(1);
    expect(s.dueSoon).toBe(1);
  });
  it("listă goală", () => {
    expect(petitionStats([], today)).toEqual({ total: 0, open: 0, dueSoon: 0, overdue: 0 });
  });
});
