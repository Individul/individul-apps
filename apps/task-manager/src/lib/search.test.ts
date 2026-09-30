import { describe, expect, it } from "vitest";
import { MIN_QUERY, countHits, search, type SearchData } from "./search";
import { PETITION_STATUS_LABEL, TASK_STATUS_LABEL } from "./status-labels";

const DATE: SearchData = {
  tasks: [
    {
      id: "t1", title: "Țiganciuc Dumitru Igor", description: "solicitare hotărîre", status: "todo",
      tags: [{ id: "g1", name: "solicitare hotărîri" }] as never, assignee_id: "n1",
    },
    { id: "t2", title: "Ataman Iurie", description: null, status: "done", tags: [] as never, assignee_id: null },
  ],
  petitions: [
    { id: "p1", number: "M-535/26", petitioner: "Țiganciuc Dumitru", subject: "art. 91", status: "in_examinare", assignee_id: "a1" },
    { id: "p2", number: "B-616/26", petitioner: "Ataman Iurie", subject: null, status: "solutionat", assignee_id: "sters" },
  ],
  plans: [
    { id: "pl1", last_name: "Țiganciuc", first_name: "Dumitru", court: "Judecătoria Chișinău", institution: 13, note: null, done: false },
    { id: "pl2", last_name: "Ataman", first_name: "Iurie", court: null, institution: 13, note: null, done: true },
  ],
  defendants: [
    { id: "d1", last_name: "Țiganciuc", first_name: "Dumitru", court: null, case_number: "1-234/2026", status: "inculpat", preventive_measure: true },
  ],
  contraveners: [
    { id: "c1", last_name: "Țiganciuc", first_name: "Dumitru", patronymic: "Ștefan", decision_date: "2026-09-10", arrest_days: 15, final_date: null, executed_on: null, informed_at: null },
  ],
  profiles: [
    { id: "n1", full_name: "Natalia Spinei" },
    { id: "a1", full_name: "Ana Cojocari" },
  ],
};

describe("căutarea peste module", () => {
  it("adună același om din toate registrele", () => {
    // Rostul întregii funcții: cinci registre, un singur nume.
    const g = search("Țiganciuc", DATE);
    expect(g.map((x) => x.kind)).toEqual([
      "sarcina", "petitie", "transfer", "prevenit", "contravenient",
    ]);
    expect(countHits(g)).toBe(5);
  });

  it("nu ține seama de diacritice", () => {
    // Scris fără diacritice, cum se tastează de obicei.
    expect(countHits(search("tiganciuc", DATE))).toBe(5);
    expect(countHits(search("TIGANCIUC", DATE))).toBe(5);
  });

  it("caută și în ce nu se vede în titlu", () => {
    // „solicitare hotărîre" e în descrierea sarcinii, nu în titlu.
    const g = search("hotarire", DATE);
    expect(g).toHaveLength(1);
    expect(g[0].hits[0].id).toBe("t1");
  });

  it("planificările încheiate nu mai apar", () => {
    // Ies din lista de lucru; altfel un transfer făcut acum o lună ar reveni
    // în rezultate la fiecare căutare a numelui.
    const g = search("Ataman", DATE);
    expect(g.some((x) => x.kind === "transfer")).toBe(false);
  });

  it("sub două litere nu caută nimic", () => {
    // O literă potrivește aproape orice: ar întoarce registrul întreg.
    expect(search("Ț", DATE)).toEqual([]);
    expect(MIN_QUERY).toBe(2);
  });

  it("spațiile din jur nu strică potrivirea", () => {
    expect(countHits(search("  ataman  ", DATE))).toBe(2);
  });

  it("fiecare rezultat duce undeva anume", () => {
    const g = search("Țiganciuc", DATE);
    const hrefs = Object.fromEntries(g.map((x) => [x.kind, x.hits[0].href]));
    expect(hrefs.sarcina).toBe("/tasks/t1");
    // Petiția se deschide chiar ea, nu registrul.
    expect(hrefs.petitie).toBe("/petitii?petitie=p1");
    expect(hrefs.transfer).toBe("/transferuri/planificare");
    expect(hrefs.prevenit).toBe("/inculpati");
    expect(hrefs.contravenient).toBe("/contravenienti");
  });

  it("contravenientul se găsește și după patronimic, cu zilele în rândul de jos", () => {
    const g = search("stefan", DATE);
    const c = g.find((x) => x.kind === "contravenient")?.hits[0];
    expect(c?.title).toBe("Țiganciuc Dumitru Ștefan");
    expect(c?.detail).toBe("15 zile arest · hotărârea din 10.09.2026");
    // Fără dată definitivă termenul nu se socotește: niciun însemn inventat.
    expect(c?.state).toBeNull();
  });

  it("contravenientul își arată termenul, socotit în ziua dată", () => {
    const rand = (x: Partial<SearchData["contraveners"][number]>) => ({
      ...DATE,
      contraveners: [{ ...DATE.contraveners[0], ...x }],
    });
    const stare = (x: Partial<SearchData["contraveners"][number]>) =>
      search("stefan", rand(x), "2026-09-29").find((g) => g.kind === "contravenient")?.hits[0];

    // Definitivă în ianuarie 2025, neexecutată: prescrisă, fără informare.
    expect(stare({ final_date: "2025-01-10" })).toMatchObject({
      state: "De informat", tone: "amber", finished: false,
    });
    // Aceeași, cu informarea trimisă: încheiată.
    expect(stare({ final_date: "2025-01-10", informed_at: "2026-01-12T08:00:00Z" })).toMatchObject({
      state: "Prescris, informat", finished: true,
    });
    // Executată: termenul nu mai contează.
    expect(stare({ final_date: "2025-01-10", executed_on: "2025-01-15" })).toMatchObject({
      state: "Executat", tone: "green", finished: true,
    });
    // Expiră peste 10 zile.
    expect(stare({ final_date: "2025-10-09" })?.state).toBe("Expiră curând");
  });

  it("categoria preventului e starea lui, citită din măsură", () => {
    const g = search("Țiganciuc", DATE);
    const prevenit = g.find((x) => x.kind === "prevenit")!;
    expect(prevenit.hits[0].state).toBe("Prevenit");
  });

  it("un nume care nu există nu întoarce grupuri goale", () => {
    expect(search("Xenofontov", DATE)).toEqual([]);
  });
});

describe("esența sarcinii", () => {
  it("rândul de jos arată etichetele, nu doar starea", () => {
    // Titlul e numele deținutului, la fel la toate sarcinile aceluiași om;
    // eticheta e ce se deosebește.
    const g = search("Țiganciuc", DATE);
    const sarcina = g.find((x) => x.kind === "sarcina")!;
    expect(sarcina.hits[0].detail).toBe("solicitare hotărîri");
  });

  it("se caută și în etichete", () => {
    // Cine scrie „audiență" vrea și sarcinile audienței, nu doar petițiile.
    const g = search("hotariri", DATE);
    expect(g.some((x) => x.kind === "sarcina")).toBe(true);
  });

  it("starea se arată chiar și fără etichete", () => {
    const g = search("Ataman", DATE);
    const sarcina = g.find((x) => x.kind === "sarcina")!;
    expect(sarcina.hits[0].detail).toBeNull();
    expect(sarcina.hits[0].state).toBe("Finalizat");
    expect(sarcina.hits[0].finished).toBe(true);
  });
});

describe("starea, cu numele din registru", () => {
  it("sarcina nefinalizată își spune starea", () => {
    const g = search("Țiganciuc", DATE);
    const sarcina = g.find((x) => x.kind === "sarcina")!;
    expect(sarcina.hits[0].state).toBe("De făcut");
    expect(sarcina.hits[0].finished).toBe(false);
  });

  it("petiția în examinare și cea soluționată se deosebesc", () => {
    const inExaminare = search("M-535", DATE)[0].hits[0];
    expect(inExaminare.state).toBe("În examinare");
    expect(inExaminare.finished).toBe(false);

    const solutionata = search("B-616", DATE)[0].hits[0];
    expect(solutionata.state).toBe("Soluționat");
    expect(solutionata.finished).toBe(true);
  });

  it("obiectul petiției rămâne în rândul de jos, nu e înlocuit de stare", () => {
    // Amândouă contează: obiectul spune despre ce e, starea unde a ajuns.
    const h = search("M-535", DATE)[0].hits[0];
    expect(h.detail).toBe("art. 91");
    expect(h.state).toBe("În examinare");
  });

  it("numele stărilor sunt chiar cele din module", () => {
    // Copiate, s-ar fi depărtat de registru la prima redenumire.
    expect(TASK_STATUS_LABEL.waiting).toBe("În așteptare");
    expect(PETITION_STATUS_LABEL.solutionat).toBe("Soluționat");
  });
});

describe("responsabilul, la fiecare rezultat", () => {
  const primul = (q: string, kind: string) =>
    search(q, DATE).find((g) => g.kind === kind)?.hits[0];

  it("sarcina și petiția își spun responsabilul, cu numele din profil", () => {
    expect(primul("Țiganciuc", "sarcina")?.responsabil).toEqual({ id: "n1", nume: "Natalia Spinei" });
    expect(primul("Țiganciuc", "petitie")?.responsabil).toEqual({ id: "a1", nume: "Ana Cojocari" });
  });

  it("fără responsabil scrie „neatribuit”, nu lasă locul gol", () => {
    expect(primul("Ataman", "sarcina")?.responsabil).toBe("neatribuit");
  });

  it("un profil dispărut nu face rândul să dispară", () => {
    // Petiția are un responsabil care nu mai e printre profiluri: rândul
    // rămâne, doar numele lipsește — altfel s-ar fi pierdut un rezultat.
    expect(primul("Ataman", "petitie")?.responsabil).toEqual({ id: "sters", nume: "(fără nume)" });
  });

  it("registrele fără responsabil nu pretind că au unul", () => {
    // `null`, nu „neatribuit”: la transferuri sau la preveniți nu lipsește
    // nimeni, pur și simplu registrul nu are rubrica asta.
    for (const kind of ["transfer", "prevenit", "contravenient"]) {
      expect(primul("Țiganciuc", kind)?.responsabil).toBeNull();
    }
  });

  it("numele responsabilului nu intră în căutare", () => {
    // Altfel „Spinei” ar aduce toate sarcinile Nataliei, nu omul căutat.
    expect(countHits(search("Spinei", DATE))).toBe(0);
  });
});
