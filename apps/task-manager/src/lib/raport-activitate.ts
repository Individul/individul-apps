import { ziuaChisinau, toISODate, type DateRange } from "./periods";
import type { Petition, Profile, Task } from "./types";

/**
 * Cine ce a încheiat într-o perioadă — sarcini și petiții, pe fiecare om.
 *
 * Numărătoarea se face aici, nu în baza de date, și nu din lene: „rămase la
 * sfârșitul perioadei" cere fiecare rând de dinaintea acelei zile, nu doar pe
 * cele din interval, iar registrul e mic (sub o sută de sarcini, sub patru sute
 * de petiții). Când va crește îndeajuns cât să se simtă, mutarea se face într-o
 * interogare, nu prin tăierea întrebărilor.
 */

/*
 * Coloanele de care are nevoie raportul; restul rândului nu se aduce.
 *
 * O singură listă, din care ies și tipul de aici, și șirul cerut bazei — vezi
 * `TASK_COUNT_COLUMNS` din `queries.ts` pentru de ce: scrise separat, cele două
 * ar fi ajuns cândva să spună lucruri diferite, iar câmpul pe care interogarea
 * nu-l aduce sosește `undefined` la fiecare rulare, fără nicio eroare.
 */
export const COLOANE_SARCINA = [
  "id",
  "title",
  "status",
  "assignee_id",
  "created_at",
  "completed_at",
] as const;
export type SarcinaRaport = Pick<Task, (typeof COLOANE_SARCINA)[number]>;

export const COLOANE_PETITIE = [
  "id",
  "number",
  "petitioner",
  "status",
  "assignee_id",
  "received_date",
  "response_date",
] as const;
export type PetitieRaport = Pick<Petition, (typeof COLOANE_PETITIE)[number]>;

/** O lucrare încheiată, așa cum apare în lista de sub cifre. */
export interface Incheiata {
  id: string;
  /** Titlul sarcinii, sau numărul și petiționarul. */
  eticheta: string;
  /** Ziua încheierii (AAAA-LL-ZZ), pentru sortare și afișare. */
  zi: string;
}

export interface Coloana {
  /** Ce a încheiat în perioadă — „câte" e lungimea, „ce" e conținutul. */
  incheiate: Incheiata[];
  /** Câte i-au intrat în perioadă. */
  intrate: number;
  /** Câte îi rămâneau neîncheiate în ultima zi a perioadei. */
  ramase: number;
}

export interface RandRaport {
  /** Id-ul profilului, sau "" pentru rândul lucrărilor fără responsabil. */
  id: string;
  nume: string;
  sarcini: Coloana;
  petitii: Coloana;
}

export interface Raport {
  randuri: RandRaport[];
  total: { sarcini: Coloana; petitii: Coloana };
  /**
   * Încheiate cărora le lipsește data, deci nu intră în nicio perioadă.
   *
   * Se arată în raport, nu se ascunde: o sarcină încheiată înainte ca baza să
   * fi început să rețină ziua nu poate fi pusă într-o lună anume, dar nici
   * trecută sub tăcere — altfel totalurile anului n-ar da suma lunilor și
   * nimeni n-ar ști de ce.
   */
  faraData: { sarcini: number; petitii: number };
}

const FARA_RESPONSABIL = "Fără responsabil";

function coloanaGoala(): Coloana {
  return { incheiate: [], intrate: 0, ramase: 0 };
}

/**
 * Raportul pe perioada dată.
 *
 * `range` vine de la `rangeForPeriod`, deci capetele sunt zile locale; se
 * compară ca text AAAA-LL-ZZ, ceea ce e și exact, și ferit de fusuri. Orele din
 * bază (`created_at`, `completed_at`) se aduc întâi la ziua Chișinăului — vezi
 * `ziuaChisinau` pentru ce se strică altfel.
 *
 * Responsabilul e cel de ACUM, nu cel din ziua încheierii. O sarcină trecută
 * luna trecută de la o colegă la alta apare la cea de azi. Istoricul atribuirii
 * există în jurnalul de audit, dar a-l reconstrui ar însemna să refacem la
 * fiecare deschidere lanțul de mutări al fiecărei lucrări — un preț mare pentru
 * o situație rară, într-o secție de trei oameni.
 */
export function construiesteRaport(
  sarcini: SarcinaRaport[],
  petitii: PetitieRaport[],
  profiluri: Profile[],
  range: DateRange,
): Raport {
  const deLa = toISODate(range.from);
  const panaLa = toISODate(range.to);
  const inInterval = (zi: string | null): boolean => !!zi && zi >= deLa && zi <= panaLa;

  // Un rând pentru fiecare om, plus unul pentru lucrările rămase fără nimeni.
  const randuri = new Map<string, RandRaport>();
  const rand = (id: string | null): RandRaport => {
    const cheie = id ?? "";
    let r = randuri.get(cheie);
    if (!r) {
      const p = profiluri.find((x) => x.id === cheie);
      r = {
        id: cheie,
        // Profilul șters sau necompletat nu e același lucru cu lipsa
        // responsabilului: lucrarea are stăpân, doar numele lui lipsește.
        nume: cheie === "" ? FARA_RESPONSABIL : (p?.full_name ?? "(fără nume)"),
        sarcini: coloanaGoala(),
        petitii: coloanaGoala(),
      };
      randuri.set(cheie, r);
    }
    return r;
  };

  const faraData = { sarcini: 0, petitii: 0 };

  for (const s of sarcini) {
    const c = rand(s.assignee_id).sarcini;
    const creata = ziuaChisinau(s.created_at);
    const incheiata = s.completed_at ? ziuaChisinau(s.completed_at) : null;

    if (inInterval(incheiata)) {
      c.incheiate.push({ id: s.id, eticheta: s.title, zi: incheiata! });
    }
    if (inInterval(creata)) c.intrate += 1;
    // Deschisă în ultima zi a perioadei: exista deja și încă nu se încheiase.
    // O sarcină redeschisă între timp și-a pierdut data (baza o șterge la
    // ieșirea din „Gata"), deci apare deschisă și în perioadele de dinainte —
    // adevărat despre ea azi, nu despre cum arăta registrul atunci.
    if (creata <= panaLa && (!incheiata || incheiata > panaLa)) c.ramase += 1;
    if (s.status === "done" && !s.completed_at) faraData.sarcini += 1;
  }

  for (const p of petitii) {
    const c = rand(p.assignee_id).petitii;
    const primita = p.received_date;
    // Ziua în care a plecat răspunsul — data pe care o scrie omul, nu ceasul
    // serverului. La petiții asta e încheierea, și era în date dinainte.
    const raspunsa = p.response_date;

    if (inInterval(raspunsa)) {
      c.incheiate.push({
        id: p.id,
        eticheta: `${p.number} — ${p.petitioner}`,
        zi: raspunsa!,
      });
    }
    if (inInterval(primita)) c.intrate += 1;
    if (primita <= panaLa && (!raspunsa || raspunsa > panaLa)) c.ramase += 1;
    if (p.status === "solutionat" && !p.response_date) faraData.petitii += 1;
  }

  const lista = [...randuri.values()];
  for (const r of lista) {
    r.sarcini.incheiate.sort((a, b) => a.zi.localeCompare(b.zi));
    r.petitii.incheiate.sort((a, b) => a.zi.localeCompare(b.zi));
  }

  /*
   * Cine apare în raport.
   *
   * Un om care n-a încheiat nimic în perioadă rămâne în tabel, cu zerouri — asta
   * e chiar una dintre întrebările pentru care se deschide raportul. Dispar doar
   * profilurile care n-au avut niciodată nimic pe numele lor: conturile de
   * probă și cele care n-au apucat să lucreze n-au ce adăuga decât rânduri
   * goale, la fel în fiecare lună.
   */
  const aAvutVreodata = new Set<string>();
  for (const s of sarcini) if (s.assignee_id) aAvutVreodata.add(s.assignee_id);
  for (const p of petitii) if (p.assignee_id) aAvutVreodata.add(p.assignee_id);
  for (const p of profiluri) if (aAvutVreodata.has(p.id)) rand(p.id);

  const areCeva = (r: RandRaport): boolean =>
    r.sarcini.incheiate.length + r.sarcini.intrate + r.sarcini.ramase +
      r.petitii.incheiate.length + r.petitii.intrate + r.petitii.ramase >
    0;

  const vizibile = [...randuri.values()].filter((r) => aAvutVreodata.has(r.id) || areCeva(r));

  vizibile.sort((a, b) => {
    // Rândul fără responsabil stă ultimul: nu e o persoană, e un rest.
    if (a.id === "" !== (b.id === "")) return a.id === "" ? 1 : -1;
    const dif =
      b.sarcini.incheiate.length + b.petitii.incheiate.length -
      (a.sarcini.incheiate.length + a.petitii.incheiate.length);
    return dif !== 0 ? dif : a.nume.localeCompare(b.nume, "ro");
  });

  const total = { sarcini: coloanaGoala(), petitii: coloanaGoala() };
  for (const r of vizibile) {
    for (const cheie of ["sarcini", "petitii"] as const) {
      total[cheie].incheiate.push(...r[cheie].incheiate);
      total[cheie].intrate += r[cheie].intrate;
      total[cheie].ramase += r[cheie].ramase;
    }
  }

  return { randuri: vizibile, total, faraData };
}
