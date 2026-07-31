/**
 * Noutățile arătate pe pagina principală.
 *
 * Se adaugă o intrare la fiecare livrare, scrisă pentru utilizator, nu pentru
 * programator: ce se schimbă pentru el, nu ce s-a modificat în cod. Cea mai
 * recentă stă prima — de ea depinde și marcajul „nou".
 */
export interface ChangelogEntry {
  /** ISO (AAAA-LL-ZZ). Se compară ca text, deci formatul e obligatoriu. */
  date: string;
  text: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-07-31",
    text: "Planificarea transferurilor: persoanele cu ședințe se grupează singure pe ziua de transfer, iar la amânare însemnarea se mută automat.",
  },
  {
    date: "2026-07-31",
    text: "La transferuri, „Adaugă transfer” se deschide pe ziua programată rămasă necompletată, nu pe ziua curentă.",
  },
  {
    date: "2026-07-31",
    text: "Modul nou, încă în testare: transferuri — deținuții transferați între penitenciare, în zilele programate din lună.",
  },
  {
    date: "2026-07-30",
    text: "Auditul se poate filtra pe module — sarcini, petiții, ședințe, utilizatori — iar fiecare modul are iconița lui.",
  },
  {
    date: "2026-07-30",
    text: "Petițiile intră în audit: se vede cine a atribuit, a soluționat, a mutat data înregistrării sau a șters un fișier.",
  },
  {
    date: "2026-07-30",
    text: "La ședințe, raportul semnalează zilele lucrătoare rămase fără date, cu link direct spre ele.",
  },
  {
    date: "2026-07-30",
    text: "Modul nou, încă în testare: ședințe de judecată — evidența zilnică, cu rapoarte pe zi, săptămână, lună, trimestru, semestru și an.",
  },
  {
    date: "2026-07-30",
    text: "Pe pagina principală, administratorul vede toate cifrele defalcate pe fiecare responsabil.",
  },
  {
    date: "2026-07-30",
    text: "Sarcinile plecate la instanță trec „În așteptare”: nu mai apar ca restante, dar se vede de câte zile durează.",
  },
  {
    date: "2026-07-30",
    text: "Modul nou, încă în testare: statistici — rapoartele se văd ca grafice, pe perioade.",
  },
  {
    date: "2026-07-29",
    text: "Petiția se deschide dintr-un click pe agrafă, direct din registru.",
  },
  {
    date: "2026-07-29",
    text: "Sarcinile și petițiile se deschid filtrate pe ce ți-e atribuit; filtrul se scoate dintr-un click.",
  },
  {
    date: "2026-07-29",
    text: "Petițiile trimit notificări la înregistrare, atribuire, soluționare și modificare.",
  },
  {
    date: "2026-07-29",
    text: "Obiectul petiției se completează din butoane, cu mai multe alegeri deodată.",
  },
  {
    date: "2026-07-29",
    text: "Fișierul petiției se atașează imediat după înregistrare, fără a o redeschide.",
  },
  {
    date: "2026-07-29",
    text: "Registrul a fost completat cu petițiile din evidența veche, cu tot cu fișierele lor.",
  },
  {
    date: "2026-07-29",
    text: "Pe pagina principală, sub cifrele tale apare și totalul secției.",
  },
  {
    date: "2026-07-28",
    text: "La petiții se pot atașa fișiere — PDF, JPG sau PNG, până la 10 MB.",
  },
  {
    date: "2026-07-28",
    text: "Modul nou: evidența petițiilor, cu termen de răspuns la 27 de zile.",
  },
  {
    date: "2026-07-28",
    text: "Pagina principală adună dintr-o privire cifrele pe sarcini și petiții.",
  },
];

/** Câte se arată pe pagina principală; restul stau în /noutati. */
export const HUB_CHANGELOG_COUNT = 4;

/**
 * E intrarea nouă față de ultima vizită?
 *
 * La prima vizită (`lastSeen` null) nimic nu e „nou": altfel un utilizator care
 * intră prima oară ar fi întâmpinat de un perete de marcaje.
 */
export function isNewSince(entryDate: string, lastSeen: string | null): boolean {
  return lastSeen !== null && entryDate > lastSeen;
}
