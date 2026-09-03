import { describe, expect, it } from "vitest";
import { MIN_QUERY, countHits, search, type SearchData } from "./search";

const DATE: SearchData = {
  tasks: [
    { id: "t1", title: "Țiganciuc Dumitru Igor", description: "solicitare hotărîre", status: "todo" },
    { id: "t2", title: "Ataman Iurie", description: null, status: "done" },
  ],
  petitions: [
    { id: "p1", number: "M-535/26", petitioner: "Țiganciuc Dumitru", subject: "art. 91", status: "in_examinare" },
    { id: "p2", number: "B-616/26", petitioner: "Ataman Iurie", subject: null, status: "solutionat" },
  ],
  plans: [
    { id: "pl1", last_name: "Țiganciuc", first_name: "Dumitru", court: "Judecătoria Chișinău", institution: 13, note: null, done: false },
    { id: "pl2", last_name: "Ataman", first_name: "Iurie", court: null, institution: 13, note: null, done: true },
  ],
  defendants: [
    { id: "d1", last_name: "Țiganciuc", first_name: "Dumitru", court: null, case_number: "1-234/2026", status: "inculpat", preventive_measure: true },
  ],
};

describe("căutarea peste module", () => {
  it("adună același om din toate registrele", () => {
    // Rostul întregii funcții: patru registre, un singur nume.
    const g = search("Țiganciuc", DATE);
    expect(g.map((x) => x.kind)).toEqual(["sarcina", "petitie", "transfer", "prevenit"]);
    expect(countHits(g)).toBe(4);
  });

  it("nu ține seama de diacritice", () => {
    // Scris fără diacritice, cum se tastează de obicei.
    expect(countHits(search("tiganciuc", DATE))).toBe(4);
    expect(countHits(search("TIGANCIUC", DATE))).toBe(4);
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
  });

  it("categoria preventului se citește din măsură, ca în registru", () => {
    const g = search("Țiganciuc", DATE);
    const prevenit = g.find((x) => x.kind === "prevenit")!;
    expect(prevenit.hits[0].detail).toContain("prevenit");
  });

  it("un nume care nu există nu întoarce grupuri goale", () => {
    expect(search("Xenofontov", DATE)).toEqual([]);
  });
});
