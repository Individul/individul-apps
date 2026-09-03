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
    date: "2026-09-02",
    text: "Pe pagina principală e o căutare peste toate registrele deodată. Scrii un nume și vezi unde apare — sarcini, petiții, planificare transferuri, preveniți. Diacriticele nu contează: „Tiganciuc” îl găsește pe „Țiganciuc”.",
  },
  {
    date: "2026-09-02",
    text: "Registrul ține acum ambele categorii: preveniți și inculpați. Se bifează măsura preventivă, iar categoria se citește din ea — cine are măsură e prevenit, ceilalți inculpați. Cifrele de sus arată ambele împărțiri.",
  },
  {
    date: "2026-09-02",
    text: "La planificarea transferurilor se poate alege temeiul: ședință de judecată sau decizie. La ședință transferul se face în ultima zi programată dinaintea ei; la decizie, în prima zi programată de la data parvenirii.",
  },
  {
    date: "2026-09-01",
    text: "Raportul de ședințe se poate muta pe orice perioadă din trecut, cu săgețile de lângă interval — direct pe pagina Ședințe, nu doar în versiunea de tipărit. Până acum arăta doar perioada curentă, deci pe 1 septembrie nu aveai cum să vezi totalul lunii august.",
  },
  {
    date: "2026-08-08",
    text: "La înregistrarea unei petiții noi, responsabilul se completează singur după litera cu care începe numele petiționarului. Se vede în formular înainte de salvare și se poate schimba oricând.",
  },
  {
    date: "2026-08-08",
    text: "Notificarea despre o petiție o deschide direct pe aceea. Până acum te lăsa în registru, să o cauți singur printre toate.",
  },
  {
    date: "2026-08-08",
    text: "Aplicația folosește acum ora Republicii Moldova. Până acum mergea pe ora serverului, cu trei ore în urmă, așa că noaptea până la ora 3 credea că e încă ziua de ieri — și arăta termenele mai puțin urgente decât erau.",
  },
  {
    date: "2026-08-07",
    text: "Notificările pot apărea și ca anunț în colțul ecranului, ca la poșta electronică. Se pornesc din clopoțelul mic de lângă titlul „Notificări” și funcționează cât timp aplicația e deschisă într-o filă.",
  },
  {
    date: "2026-08-07",
    text: "Banda de termene are o treaptă nouă: în chiar ziua termenului devine portocalie, între galbenul „se apropie” și roșul „ai depășit”.",
  },
  {
    date: "2026-08-07",
    text: "Aplicația are pictogramă proprie: fila din browser se recunoaște acum dintr-o privire printre celelalte.",
  },
  {
    date: "2026-08-06",
    text: "Pagina de statistici poartă în diagonală însemnul „în testare”, ca cifrele de acolo să nu fie preluate ca oficiale până la verificare.",
  },
  {
    date: "2026-08-06",
    text: "Sarcinile și petițiile se citesc acum și pe monitoare mici: coloanele nu se mai suprapun, iar rezumatul din dreapta coboară sub tabel când ecranul e prea îngust pentru amândouă.",
  },
  {
    date: "2026-08-03",
    text: "Defalcarea pe responsabili se vede de către toți, nu doar de administrator — la sarcini și la petiții.",
  },
  {
    date: "2026-08-03",
    text: "Registru nou: inculpații cu tip de penitenciar stabilit. Cine devine condamnat iese din listă, dar rămâne în evidență.",
  },
  {
    date: "2026-08-03",
    text: "Informările periodice către ANP au evidență proprie: termenul se recalculează singur, iar cele apropiate sau restante apar pe pagina principală.",
  },
  {
    date: "2026-08-03",
    text: "Copia de siguranță se face automat în fiecare noapte, cu o a doua rulare de rezervă dacă prima nu reușește.",
  },
  {
    date: "2026-07-31",
    text: "Raportul de ședințe are versiune de tipărit: se alege perioada și se tipărește sau se salvează ca PDF.",
  },
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
