import { describe, expect, it } from "vitest";
import { construiesteRaport, type PetitieRaport, type SarcinaRaport } from "./raport-activitate";
import { rangeForPeriod, parseISODate } from "./periods";
import type { Profile } from "./types";

const ANA = { id: "a1", full_name: "Ana Cojocari", role: "member" } as Profile;
const NATALIA = { id: "n1", full_name: "Natalia Spinei", role: "member" } as Profile;
const PROFILURI = [ANA, NATALIA];

/** Septembrie 2026, perioada folosită de aproape toate probele de mai jos. */
const SEPTEMBRIE = rangeForPeriod("luna", parseISODate("2026-09-15"));

const s = (x: Partial<SarcinaRaport> & { id: string }): SarcinaRaport => ({
  title: `Sarcina ${x.id}`,
  status: "done",
  assignee_id: ANA.id,
  created_at: "2026-09-01T09:00:00+00:00",
  completed_at: null,
  ...x,
});

const p = (x: Partial<PetitieRaport> & { id: string }): PetitieRaport => ({
  number: `${x.id}/26`,
  petitioner: "Popescu Ion",
  status: "solutionat",
  assignee_id: ANA.id,
  received_date: "2026-09-01",
  response_date: null,
  ...x,
});

const randul = (raport: ReturnType<typeof construiesteRaport>, nume: string) =>
  raport.randuri.find((r) => r.nume === nume);

describe("ce s-a încheiat în perioadă", () => {
  it("numără și enumeră sarcinile încheiate, pe responsabil", () => {
    const raport = construiesteRaport(
      [
        s({ id: "1", completed_at: "2026-09-10T08:00:00+00:00" }),
        s({ id: "2", completed_at: "2026-09-12T08:00:00+00:00" }),
        s({ id: "3", completed_at: "2026-09-11T08:00:00+00:00", assignee_id: NATALIA.id }),
      ],
      [],
      PROFILURI,
      SEPTEMBRIE,
    );
    expect(randul(raport, "Ana Cojocari")?.sarcini.incheiate.map((x) => x.id)).toEqual(["1", "2"]);
    expect(randul(raport, "Natalia Spinei")?.sarcini.incheiate).toHaveLength(1);
    expect(raport.total.sarcini.incheiate).toHaveLength(3);
  });

  it("petiția se socotește după ziua în care a plecat răspunsul", () => {
    const raport = construiesteRaport(
      [],
      [
        p({ id: "1", received_date: "2026-08-20", response_date: "2026-09-03" }),
        // Primită în septembrie, răspunsă în octombrie: intră, dar nu se încheie.
        p({ id: "2", received_date: "2026-09-28", response_date: "2026-10-02" }),
      ],
      PROFILURI,
      SEPTEMBRIE,
    );
    const r = randul(raport, "Ana Cojocari")!;
    expect(r.petitii.incheiate.map((x) => x.id)).toEqual(["1"]);
    expect(r.petitii.intrate).toBe(1);
  });

  it("eticheta petiției poartă numărul și petiționarul", () => {
    const raport = construiesteRaport(
      [],
      [p({ id: "1", number: "42/26", petitioner: "Cebotari Ion", response_date: "2026-09-05" })],
      PROFILURI,
      SEPTEMBRIE,
    );
    expect(raport.total.petitii.incheiate[0].eticheta).toBe("42/26 — Cebotari Ion");
  });

  it("lista încheiatelor merge cronologic", () => {
    const raport = construiesteRaport(
      [
        s({ id: "tarziu", completed_at: "2026-09-20T08:00:00+00:00" }),
        s({ id: "devreme", completed_at: "2026-09-02T08:00:00+00:00" }),
      ],
      [],
      PROFILURI,
      SEPTEMBRIE,
    );
    expect(randul(raport, "Ana Cojocari")?.sarcini.incheiate.map((x) => x.id)).toEqual([
      "devreme",
      "tarziu",
    ]);
  });
});

describe("marginile perioadei", () => {
  it("ultima zi a lunii intră, prima zi a lunii următoare nu", () => {
    const raport = construiesteRaport(
      [
        s({ id: "in", completed_at: "2026-09-30T10:00:00+00:00" }),
        s({ id: "afara", completed_at: "2026-10-01T10:00:00+00:00" }),
      ],
      [],
      PROFILURI,
      SEPTEMBRIE,
    );
    expect(randul(raport, "Ana Cojocari")?.sarcini.incheiate.map((x) => x.id)).toEqual(["in"]);
  });

  it("ora se citește la Chișinău, nu la Greenwich", () => {
    /*
     * 31 august, 21:30 UTC, e deja 1 septembrie la Chișinău (vara, +3). Tăiată
     * cu `slice(0, 10)`, ziua ar cădea în august, iar sarcina ar lipsi din
     * raportul lunii septembrie fără ca cineva să aibă cum observa.
     */
    const raport = construiesteRaport(
      [s({ id: "1", completed_at: "2026-08-31T21:30:00+00:00" })],
      [],
      PROFILURI,
      SEPTEMBRIE,
    );
    expect(randul(raport, "Ana Cojocari")?.sarcini.incheiate).toHaveLength(1);
  });
});

describe("ce a intrat și ce a rămas", () => {
  it("rămasele sunt cele deschise în ultima zi a perioadei", () => {
    const raport = construiesteRaport(
      [
        // Deschisă și azi: rămâne.
        s({ id: "deschisa", status: "todo", created_at: "2026-09-02T08:00:00+00:00" }),
        // Închisă în perioadă: a intrat, nu rămâne.
        s({
          id: "inchisa",
          created_at: "2026-09-02T08:00:00+00:00",
          completed_at: "2026-09-04T08:00:00+00:00",
        }),
        // Închisă abia în octombrie: la 30 septembrie era încă deschisă.
        s({
          id: "dupa",
          created_at: "2026-09-02T08:00:00+00:00",
          completed_at: "2026-10-04T08:00:00+00:00",
        }),
      ],
      [],
      PROFILURI,
      SEPTEMBRIE,
    );
    const r = randul(raport, "Ana Cojocari")!;
    expect(r.sarcini.intrate).toBe(3);
    expect(r.sarcini.incheiate).toHaveLength(1);
    expect(r.sarcini.ramase).toBe(2);
  });

  it("o lucrare mai veche, încă deschisă, se numără la rămase fără să fie intrată", () => {
    const raport = construiesteRaport(
      [s({ id: "veche", status: "todo", created_at: "2026-05-02T08:00:00+00:00" })],
      [],
      PROFILURI,
      SEPTEMBRIE,
    );
    const r = randul(raport, "Ana Cojocari")!;
    expect(r.sarcini.intrate).toBe(0);
    expect(r.sarcini.ramase).toBe(1);
  });

  it("ce s-a născut după perioadă nu se numără nicăieri", () => {
    const raport = construiesteRaport(
      [s({ id: "viitor", status: "todo", created_at: "2026-11-02T08:00:00+00:00" })],
      [],
      PROFILURI,
      SEPTEMBRIE,
    );
    const r = randul(raport, "Ana Cojocari");
    expect(r?.sarcini.intrate).toBe(0);
    expect(r?.sarcini.ramase).toBe(0);
  });
});

describe("lucrările fără dată sau fără responsabil", () => {
  it("încheiatele fără dată se numără deoparte, nu se pierd", () => {
    const raport = construiesteRaport(
      [s({ id: "1", status: "done", completed_at: null })],
      [p({ id: "2", status: "solutionat", response_date: null })],
      PROFILURI,
      SEPTEMBRIE,
    );
    expect(raport.faraData).toEqual({ sarcini: 1, petitii: 1 });
    expect(raport.total.sarcini.incheiate).toHaveLength(0);
  });

  it("lucrarea fără responsabil primește rândul ei, așezat ultimul", () => {
    const raport = construiesteRaport(
      [s({ id: "1", assignee_id: null, completed_at: "2026-09-10T08:00:00+00:00" })],
      [],
      PROFILURI,
      SEPTEMBRIE,
    );
    expect(raport.randuri[raport.randuri.length - 1].nume).toBe("Fără responsabil");
    expect(raport.total.sarcini.incheiate).toHaveLength(1);
  });
});

describe("cine apare în tabel", () => {
  it("omul fără nimic în perioadă rămâne, cu zerouri", () => {
    // Tocmai asta se caută uneori în raport; un rând lipsă n-ar spune nimic.
    const raport = construiesteRaport(
      [s({ id: "1", completed_at: "2026-09-10T08:00:00+00:00" }), s({ id: "2", assignee_id: NATALIA.id, status: "todo", created_at: "2026-01-04T08:00:00+00:00" })],
      [],
      PROFILURI,
      rangeForPeriod("luna", parseISODate("2026-09-15")),
    );
    const n = randul(raport, "Natalia Spinei");
    expect(n).toBeDefined();
    expect(n?.sarcini.incheiate).toHaveLength(0);
  });

  it("profilul care n-a avut niciodată nimic nu apare", () => {
    const TEST = { id: "t1", full_name: "test", role: "member" } as Profile;
    const raport = construiesteRaport(
      [s({ id: "1", completed_at: "2026-09-10T08:00:00+00:00" })],
      [],
      [...PROFILURI, TEST],
      SEPTEMBRIE,
    );
    expect(randul(raport, "test")).toBeUndefined();
  });

  it("primul e cine a încheiat mai mult", () => {
    const raport = construiesteRaport(
      [
        s({ id: "1", assignee_id: NATALIA.id, completed_at: "2026-09-10T08:00:00+00:00" }),
        s({ id: "2", assignee_id: NATALIA.id, completed_at: "2026-09-11T08:00:00+00:00" }),
        s({ id: "3", completed_at: "2026-09-12T08:00:00+00:00" }),
      ],
      [],
      PROFILURI,
      SEPTEMBRIE,
    );
    expect(raport.randuri[0].nume).toBe("Natalia Spinei");
  });
});
