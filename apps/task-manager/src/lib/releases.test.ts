import { describe, expect, it } from "vitest";
import {
  RELEASE_GROUNDS,
  groundLabel,
  groupedGroundOptions,
  fullName,
  releaseState,
  monthSummary,
  notificationRecipients,
  responsibleLabel,
  shiftMonth,
  readMonth,
  monthLabelRo,
  type ReleasePlan,
} from "./releases";
import type { Profile } from "./types";

function plan(over: Partial<ReleasePlan> = {}): ReleasePlan {
  return {
    id: crypto.randomUUID(),
    last_name: "Popescu",
    first_name: "Ion",
    release_date: "2026-08-20",
    ground: "termen_executat",
    done: false,
    notified_at: null,
    note: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: crypto.randomUUID(),
    full_name: "Ana Cojocari",
    username: null,
    avatar_url: null,
    role: "member",
    handles_releases: false,
    ...over,
  };
}

const AZI = new Date(2026, 7, 14); // 14 august 2026

describe("temeiurile", () => {
  it("sunt nouăsprezece", () => {
    expect(Object.keys(RELEASE_GROUNDS)).toHaveLength(19);
  });

  it("se împart în condamnați și preveniți, nouă și zece", () => {
    const grupe = groupedGroundOptions();
    expect(grupe.map((g) => g.category)).toEqual(["condamnati", "preveniti"]);
    expect(grupe[0].options).toHaveLength(9);
    expect(grupe[1].options).toHaveLength(10);
  });

  it("dă eticheta scrisă, nu codul", () => {
    expect(groundLabel("art_91")).toBe("Art. 91 (condiționat)");
  });
});

describe("fullName", () => {
  it("pune numele de familie primul, ca în registru", () => {
    expect(fullName(plan({ last_name: "Rusu", first_name: "Vasile" }))).toBe("Rusu Vasile");
  });
});

describe("releaseState", () => {
  it("bifat înseamnă gata, indiferent de dată", () => {
    expect(releaseState(plan({ release_date: "2026-08-01", done: true }), AZI)).toBe("gata");
    expect(releaseState(plan({ release_date: "2026-08-31", done: true }), AZI)).toBe("gata");
  });

  it("azi e o stare de sine stătătoare", () => {
    expect(releaseState(plan({ release_date: "2026-08-14" }), AZI)).toBe("azi");
  });

  it("o dată trecută și nebifată e restanță", () => {
    expect(releaseState(plan({ release_date: "2026-08-13" }), AZI)).toBe("restant");
  });

  it("restul e viitor", () => {
    expect(releaseState(plan({ release_date: "2026-08-15" }), AZI)).toBe("viitor");
  });
});

describe("monthSummary", () => {
  const luna = [
    plan({ release_date: "2026-08-03", done: true }),
    plan({ release_date: "2026-08-10", done: true }),
    plan({ release_date: "2026-08-14" }),
    plan({ release_date: "2026-08-20" }),
    plan({ release_date: "2026-08-12" }), // trecut, nebifat
  ];

  it("numără tot, dar listează doar ce a rămas", () => {
    const s = monthSummary(luna, "2026-08", AZI);
    expect(s.total).toBe(5);
    expect(s.done).toBe(2);
    expect(s.remaining).toHaveLength(3);
  });

  it("pune restanțele primele, apoi cronologic", () => {
    const s = monthSummary(luna, "2026-08", AZI);
    expect(s.remaining.map((r) => r.plan.release_date)).toEqual([
      "2026-08-12",
      "2026-08-14",
      "2026-08-20",
    ]);
    expect(s.remaining.map((r) => r.state)).toEqual(["restant", "azi", "viitor"]);
  });

  it("nu ia rândurile din alte luni", () => {
    const s = monthSummary([...luna, plan({ release_date: "2026-09-01" })], "2026-08", AZI);
    expect(s.total).toBe(5);
  });

  it("o lună goală nu e o eroare", () => {
    const s = monthSummary([], "2026-08", AZI);
    expect(s).toEqual({ total: 0, done: 0, remaining: [] });
  });
});

describe("notificationRecipients", () => {
  it("cei bifați ca responsabili", () => {
    const ana = profile({ handles_releases: true });
    const altul = profile();
    expect(notificationRecipients([ana, altul])).toEqual([ana.id]);
  });

  it("fără nimeni bifat, administratorii", () => {
    const admin = profile({ role: "admin" });
    const membru = profile();
    expect(notificationRecipients([admin, membru])).toEqual([admin.id]);
  });

  it("bifa bate rolul: adminul nebifat nu primește dacă există un responsabil", () => {
    const ana = profile({ handles_releases: true });
    const admin = profile({ role: "admin" });
    expect(notificationRecipients([ana, admin])).toEqual([ana.id]);
  });
});

describe("responsibleLabel", () => {
  it("numele celui bifat", () => {
    expect(responsibleLabel([profile({ full_name: "Ana Cojocari", handles_releases: true })])).toBe(
      "Ana Cojocari",
    );
  });

  it("mai mulți, despărțiți prin virgulă", () => {
    const doi = [
      profile({ full_name: "Ana Cojocari", handles_releases: true }),
      profile({ full_name: "Ion Rusu", handles_releases: true }),
    ];
    expect(responsibleLabel(doi)).toBe("Ana Cojocari, Ion Rusu");
  });

  it("nimeni bifat: null, deci eticheta nu se afișează deloc", () => {
    expect(responsibleLabel([profile()])).toBeNull();
  });
});

describe("navigarea între luni", () => {
  it("shiftMonth trece corect peste marginea anului", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("readMonth cade pe luna curentă la valori lipsă sau imposibile", () => {
    expect(readMonth("2026-03", AZI)).toBe("2026-03");
    expect(readMonth(undefined, AZI)).toBe("2026-08");
    expect(readMonth("2026-13", AZI)).toBe("2026-08");
    expect(readMonth("august", AZI)).toBe("2026-08");
  });

  it("readMonth netezește parametrul repetat, cum face readWeek", () => {
    // `?luna=2026-03&luna=2026-05` ajunge la pagină ca listă, nu ca text.
    expect(readMonth(["2026-03", "2026-05"], AZI)).toBe("2026-03");
    expect(readMonth([], AZI)).toBe("2026-08");
    expect(readMonth(null, AZI)).toBe("2026-08");
  });

  it("monthLabelRo scrie luna pe românește", () => {
    expect(monthLabelRo("2026-08")).toBe("august 2026");
  });
});
