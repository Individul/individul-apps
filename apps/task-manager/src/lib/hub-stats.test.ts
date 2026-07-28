import { describe, it, expect } from "vitest";
import {
  taskStats,
  petitionStats,
  countsByAssignee,
  isTaskOverdue,
  isPetitionOverdue,
} from "./hub-stats";
import type { Task, Petition, Profile } from "./types";

const prof = (id: string, name: string | null): Profile => ({
  id, full_name: name, username: null, avatar_url: null, role: "member",
});

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

describe("countsByAssignee", () => {
  const profiles = [prof("a", "Ana"), prof("b", "Bogdan")];

  it("grupează și sortează descrescător", () => {
    const r = countsByAssignee(
      [{ assignee_id: "b" }, { assignee_id: "a" }, { assignee_id: "b" }],
      profiles,
    );
    expect(r).toEqual([
      { id: "b", name: "Bogdan", count: 2, overdue: 0 },
      { id: "a", name: "Ana", count: 1, overdue: 0 },
    ]);
  });

  it("pune Neatribuit la final", () => {
    const r = countsByAssignee(
      [{ assignee_id: null }, { assignee_id: null }, { assignee_id: "a" }],
      profiles,
    );
    expect(r.map((x) => x.name)).toEqual(["Ana", "Neatribuit"]);
    expect(r[1].count).toBe(2);
  });

  it("tratează profil lipsă ca Neatribuit", () => {
    const r = countsByAssignee([{ assignee_id: "zzz" }], profiles);
    expect(r).toEqual([{ id: null, name: "Neatribuit", count: 1, overdue: 0 }]);
  });

  it("nume lipsă → (fără nume)", () => {
    const r = countsByAssignee([{ assignee_id: "c" }], [prof("c", null)]);
    expect(r[0].name).toBe("(fără nume)");
  });

  it("la egalitate sortează alfabetic", () => {
    const r = countsByAssignee([{ assignee_id: "b" }, { assignee_id: "a" }], profiles);
    expect(r.map((x) => x.name)).toEqual(["Ana", "Bogdan"]);
  });

  it("listă goală", () => {
    expect(countsByAssignee([], profiles)).toEqual([]);
  });

  it("numără restanțele per persoană cu predicatul dat", () => {
    const items = [
      { assignee_id: "a", late: true },
      { assignee_id: "a", late: false },
      { assignee_id: "b", late: true },
      { assignee_id: "b", late: true },
    ];
    // count egal (2 vs 2) → la egalitate sortarea e alfabetică
    const r = countsByAssignee(items, profiles, (i) => i.late);
    expect(r).toEqual([
      { id: "a", name: "Ana", count: 2, overdue: 1 },
      { id: "b", name: "Bogdan", count: 2, overdue: 2 },
    ]);
  });
});

describe("isTaskOverdue / isPetitionOverdue", () => {
  it("sarcină restantă doar dacă nu e finalizată", () => {
    expect(isTaskOverdue(t({ due_date: "2026-07-20" }), today)).toBe(true);
    expect(isTaskOverdue(t({ due_date: "2026-07-20", status: "done" }), today)).toBe(false);
    expect(isTaskOverdue(t({ due_date: "2026-08-10" }), today)).toBe(false);
    expect(isTaskOverdue(t({ due_date: null }), today)).toBe(false);
  });

  it("petiție restantă doar dacă e în examinare", () => {
    expect(isPetitionOverdue(p({ response_deadline: "2026-07-20" }), today)).toBe(true);
    expect(
      isPetitionOverdue(p({ response_deadline: "2026-07-20", status: "solutionat" }), today),
    ).toBe(false);
    expect(isPetitionOverdue(p({ response_deadline: "2026-09-01" }), today)).toBe(false);
  });
});
