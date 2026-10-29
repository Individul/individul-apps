import { describe, expect, it } from "vitest";
import {
  esteInstiintat,
  groupByTransferDay,
  matchesPlan,
  planDate,
  planTransferDay,
  termenDepasit,
  termenLimita,
  transferDayFor,
  transferDayForDecision,
  type TransferPlan,
} from "./transfer-plans";
import { scheduledDays } from "./transfers";
import { toISODate } from "./periods";

// Zile programate: 6 și 20 iulie 2026, 3 și 17 august 2026.
const IUL = scheduledDays(2026, 6).map(toISODate);
const AUG = scheduledDays(2026, 7).map(toISODate);

const plan = (over: Partial<TransferPlan>): TransferPlan => ({
  id: "1", last_name: "Popescu", first_name: "Ion",
  basis: "sedinta", court: "Judecătoria Chișinău", institution: 13,
  hearing_date: "2026-08-05", decision_date: null, done: false, note: null,
  created_by: null, updated_by: null, created_at: "", updated_at: "", ...over,
});

describe("zilele de referință", () => {
  it("iulie și august 2026", () => {
    expect(IUL).toEqual(["2026-07-06", "2026-07-20"]);
    expect(AUG).toEqual(["2026-08-03", "2026-08-17"]);
  });
});

describe("transferDayFor", () => {
  const azi = new Date(2026, 6, 31); // 31 iulie 2026

  it("alege ultima zi programată dinaintea ședinței, nu prima disponibilă", () => {
    // Ședință pe 20 august: se poate și pe 3, dar omul ar aștepta două
    // săptămâni degeaba la altă instituție.
    expect(transferDayFor(new Date(2026, 7, 20), azi)).toBe("2026-08-17");
  });

  it("ședință între zilele programate", () => {
    expect(transferDayFor(new Date(2026, 7, 5), azi)).toBe("2026-08-03");
  });

  it("nu propune ziua ședinței, chiar dacă e zi de transfer", () => {
    // Ședință pe 20 iulie, care e și zi programată: transferul de atunci nu mai
    // ajută, deci rămâne cel de pe 6.
    expect(transferDayFor(new Date(2026, 6, 20), new Date(2026, 6, 1))).toBe("2026-07-06");
  });

  it("sare peste zilele deja trecute", () => {
    // Pe 10 iulie, ziua de 6 a trecut; pentru o ședință pe 3 august rămâne 20.
    expect(transferDayFor(new Date(2026, 7, 3), new Date(2026, 6, 10))).toBe("2026-07-20");
  });

  it("fără zi posibilă → null, adică de înștiințat instanța", () => {
    // Ședință pe 1 august; ultima zi programată înainte era 20 iulie, trecută.
    expect(transferDayFor(new Date(2026, 7, 1), azi)).toBeNull();
  });

  it("ședință chiar azi → null", () => {
    expect(transferDayFor(azi, azi)).toBeNull();
  });

  it("ședință peste luni de zile", () => {
    // Octombrie 2026: prima luni 5, a treia 19.
    expect(transferDayFor(new Date(2026, 9, 21), azi)).toBe("2026-10-19");
  });
});

describe("groupByTransferDay", () => {
  const azi = new Date(2026, 6, 31);

  it("grupează pe ziua calculată, cronologic", () => {
    const groups = groupByTransferDay(
      [
        plan({ id: "a", hearing_date: "2026-08-20" }), // → 17 aug
        plan({ id: "b", hearing_date: "2026-08-05" }), // → 3 aug
      ],
      azi,
    );
    expect(groups.map((g) => g.day)).toEqual(["2026-08-03", "2026-08-17"]);
  });

  it("cele fără zi posibilă ies primele", () => {
    const groups = groupByTransferDay(
      [
        plan({ id: "a", hearing_date: "2026-08-20" }),
        plan({ id: "b", hearing_date: "2026-08-01" }), // imposibil
      ],
      azi,
    );
    expect(groups[0].day).toBeNull();
    expect(groups[0].plans.map((p) => p.id)).toEqual(["b"]);
  });

  it("cele încheiate nu mai apar", () => {
    const groups = groupByTransferDay([plan({ done: true })], azi);
    expect(groups).toEqual([]);
  });

  it("în aceeași zi, după penitenciar, de la numărul mic la cel mare", () => {
    const groups = groupByTransferDay(
      [
        plan({ id: "p13", institution: 13, hearing_date: "2026-08-05" }),
        plan({ id: "p2", institution: 2, hearing_date: "2026-08-14" }),
        plan({ id: "p11", institution: 11, hearing_date: "2026-08-06" }),
      ],
      azi,
    );
    expect(groups[0].plans.map((p) => p.id)).toEqual(["p2", "p11", "p13"]);
  });

  it("la același penitenciar, data, apoi numele", () => {
    const groups = groupByTransferDay(
      [
        plan({ id: "zamfir", last_name: "Zamfir", hearing_date: "2026-08-05" }),
        plan({ id: "tarziu", last_name: "Arnaut", hearing_date: "2026-08-14" }),
        plan({ id: "arnaut", last_name: "Arnaut", hearing_date: "2026-08-05" }),
      ],
      azi,
    );
    expect(groups[0].plans.map((p) => p.id)).toEqual(["arnaut", "zamfir", "tarziu"]);
  });

  it("în aceeași zi, ședințele mai apropiate primele", () => {
    const groups = groupByTransferDay(
      [
        plan({ id: "tarziu", hearing_date: "2026-08-14" }),
        plan({ id: "devreme", hearing_date: "2026-08-05" }),
      ],
      azi,
    );
    expect(groups[0].plans.map((p) => p.id)).toEqual(["devreme", "tarziu"]);
  });

  it("amânarea mută însemnarea pe altă zi", () => {
    // Motivul principal al modulului: o ședință amânată nu mai cere
    // replanificare manuală.
    const inainte = groupByTransferDay([plan({ hearing_date: "2026-08-05" })], azi);
    const dupa = groupByTransferDay([plan({ hearing_date: "2026-08-20" })], azi);
    expect(inainte[0].day).toBe("2026-08-03");
    expect(dupa[0].day).toBe("2026-08-17");
  });
});

/*
 * Zilele programate din iulie–august 2026: 6 și 20 iulie, 3 și 17 august.
 * Regula deciziei e răsturnată față de a ședinței — de aceea are teste proprii,
 * nu doar o variantă a celor de sus.
 */
describe("transferul în baza unei decizii", () => {
  it("merge la prima zi programată de după parvenire", () => {
    // Decizie pe 10 iulie: prima zi de după e 20 iulie.
    expect(transferDayForDecision(new Date(2026, 6, 10), new Date(2026, 6, 1))).toBe("2026-07-20");
  });

  it("dacă parvine chiar într-o zi de transfer, aceea e", () => {
    expect(transferDayForDecision(new Date(2026, 6, 6), new Date(2026, 6, 1))).toBe("2026-07-06");
  });

  it("parvenită după ultima zi a lunii, trece în luna următoare", () => {
    expect(transferDayForDecision(new Date(2026, 6, 25), new Date(2026, 6, 1))).toBe("2026-08-03");
  });

  it("o decizie veche neexecutată nu trimite omul la o zi trecută", () => {
    // Parvenită pe 10 iulie, ziua ei (20 iulie) a trecut, azi e 25 iulie:
    // se mută la următoarea, ca o ședință amânată.
    expect(transferDayForDecision(new Date(2026, 6, 10), new Date(2026, 6, 25))).toBe("2026-08-03");
  });

  it("nu întoarce niciodată „de înștiințat instanța”", () => {
    // Spre deosebire de ședință, aici există întotdeauna o zi următoare.
    const p = plan({ basis: "decizie", court: null, hearing_date: null, decision_date: "2026-07-10" });
    expect(planTransferDay(p, new Date(2026, 6, 1))).toBe("2026-07-20");
  });
});

describe("ședințe și decizii în aceeași listă", () => {
  it("se adună pe aceeași zi de transfer când coincid", () => {
    const azi = new Date(2026, 6, 1);
    // Ședință pe 22 iulie → ultima zi dinainte e 20 iulie.
    const sedinta = plan({ id: "s", hearing_date: "2026-07-22" });
    // Decizie parvenită pe 10 iulie → prima zi de după e tot 20 iulie.
    const decizie = plan({
      id: "d", basis: "decizie", court: null, hearing_date: null, decision_date: "2026-07-10",
    });
    const grupe = groupByTransferDay([sedinta, decizie], azi);
    expect(grupe).toHaveLength(1);
    expect(grupe[0].day).toBe("2026-07-20");
    expect(grupe[0].plans.map((x) => x.id).sort()).toEqual(["d", "s"]);
  });
});

describe("înștiințarea instanței despre imposibilitatea executării", () => {
  it("fără nimic completat, nu e înștiințată", () => {
    expect(esteInstiintat(plan({}))).toBe(false);
  });

  it("expediată pentru ședința de acum", () => {
    expect(
      esteInstiintat(
        plan({
          hearing_date: "2026-08-05",
          notified_at: "2026-08-01T09:00:00Z",
          notified_hearing_date: "2026-08-05",
        }),
      ),
    ).toBe(true);
  });

  it("după amânare nu mai acoperă noua ședință", () => {
    // Cazul pentru care există coloana. Hârtia s-a trimis pentru ședința din 5
    // august; instanța a amânat pe 20 septembrie, care iar n-are zi de transfer
    // înainte. E altă imposibilitate și cere altă înștiințare — iar bifa veche,
    // lăsată aprinsă, ar fi spus contrariul.
    expect(
      esteInstiintat(
        plan({
          hearing_date: "2026-09-20",
          notified_at: "2026-08-01T09:00:00Z",
          notified_hearing_date: "2026-08-05",
        }),
      ),
    ).toBe(false);
  });

  it("dacă ședința se întoarce la data dintâi, înștiințarea o acoperă iar", () => {
    // Nu e o subtilitate căutată: instanțele revin la termenul dintâi. Hârtia
    // trimisă atunci vorbea chiar despre ședința asta.
    expect(
      esteInstiintat(
        plan({
          hearing_date: "2026-08-05",
          notified_at: "2026-08-01T09:00:00Z",
          notified_hearing_date: "2026-08-05",
        }),
      ),
    ).toBe(true);
  });

  it("o dată fără ședința pentru care s-a trimis nu se ia drept înștiințare", () => {
    // Constrângerea din 0029 nu îngăduie starea asta, dar rândurile scrise
    // înaintea migrării n-au coloanele deloc — iar de acolo vin `undefined`.
    expect(esteInstiintat(plan({ notified_at: "2026-08-01T09:00:00Z" }))).toBe(false);
    expect(esteInstiintat(plan({ notified_hearing_date: "2026-08-05" }))).toBe(false);
  });

  it("la temei „decizie” nu se pune problema", () => {
    // Acolo ziua de transfer există întotdeauna, deci nu se ajunge niciodată la
    // grupul „de înștiințat"; `hearing_date` e `null` și nimic nu se potrivește.
    expect(
      esteInstiintat(
        plan({
          basis: "decizie",
          hearing_date: null,
          decision_date: "2026-08-01",
          notified_at: "2026-08-01T09:00:00Z",
          notified_hearing_date: "2026-08-05",
        }),
      ),
    ).toBe(false);
  });
});

describe("matchesPlan", () => {
  const p = plan({
    last_name: "Țiganciuc", first_name: "Dumitru", court: "Judecătoria Bălți, sediul Central",
    institution: 13, note: "vine din izolator",
  });

  it("căutarea goală le arată pe toate", () => {
    expect(matchesPlan(p, "")).toBe(true);
    expect(matchesPlan(p, "   ")).toBe(true);
  });

  it("după nume, fără diacritice și fără majuscule", () => {
    expect(matchesPlan(p, "tiganciuc")).toBe(true);
    expect(matchesPlan(p, "DUMITRU")).toBe(true);
  });

  it("după instanță", () => {
    expect(matchesPlan(p, "balti")).toBe(true);
  });

  it("după penitenciar, cum e scris pe ecran", () => {
    expect(matchesPlan(p, "nr. 13")).toBe(true);
    expect(matchesPlan(p, "penitenciarul 13")).toBe(false);
  });

  it("și în observații, unde stă adesea detaliul căutat", () => {
    expect(matchesPlan(p, "izolator")).toBe(true);
  });

  it("fără instanță și fără observații nu se strică", () => {
    expect(matchesPlan(plan({ court: null, note: null }), "popescu")).toBe(true);
  });

  it("un nume străin nu se potrivește", () => {
    expect(matchesPlan(p, "Popescu")).toBe(false);
  });
});

describe("temeiul „30 zile”", () => {
  // Încheiere din 15 octombrie, introdusă în modul pe 20 octombrie 2026.
  const t30 = (over: Partial<TransferPlan> = {}) =>
    plan({
      basis: "termen30", hearing_date: null, decision_date: null,
      ruling_date: "2026-10-15", term_start: "2026-10-20", ...over,
    });

  it("termenul curge de la introducere, nu de la data încheierii", () => {
    expect(termenLimita(t30())).toBe("2026-11-19");
  });

  it("celelalte temeiuri n-au termen-limită", () => {
    expect(termenLimita(plan({}))).toBeNull();
    expect(termenLimita(plan({ basis: "decizie", hearing_date: null, decision_date: "2026-10-20" }))).toBeNull();
  });

  it("transferul e la prima zi programată de la introducere, ca la decizie", () => {
    // De la 20 octombrie 2026, prima zi programată (luni 1 sau 3 din lună) e 2 noiembrie.
    expect(planTransferDay(t30(), new Date(2026, 9, 20))).toBe("2026-11-02");
  });

  it("pe rând se arată data încheierii", () => {
    expect(planDate(t30())).toBe("2026-10-15");
  });

  it("în termen, nu se semnalează nimic", () => {
    expect(termenDepasit(t30(), new Date(2026, 9, 20))).toBe(false);
  });

  it("după ce trec cele 30 de zile, rândul neîncheiat se semnalează", () => {
    // 20 noiembrie: termenul (19 noiembrie) a trecut, orice zi rămasă e după el.
    expect(termenDepasit(t30(), new Date(2026, 10, 20))).toBe(true);
  });

  it("chiar înainte de termen, dacă prima zi de transfer cade după el", () => {
    // Pe 18 noiembrie, ultima zi programată din termen (luni, 16 noiembrie) a
    // trecut; următoarea e 7 decembrie — după 19 noiembrie, deci omul nu mai
    // apucă să plece în termen, deși termenul încă n-a expirat.
    expect(termenDepasit(t30(), new Date(2026, 10, 18))).toBe(true);
  });

  it("cel încheiat nu se mai semnalează: a plecat", () => {
    expect(termenDepasit(t30({ done: true }), new Date(2026, 10, 25))).toBe(false);
  });

  it("fără ziua introducerii nu se poate socoti nimic", () => {
    const fara = t30({ term_start: null });
    expect(planTransferDay(fara, new Date(2026, 9, 20))).toBeNull();
    expect(termenDepasit(fara, new Date(2026, 10, 25))).toBe(false);
  });
});
