export const INSTANTE = {
  jc: 'Judecătoria Chișinău',
  jsr: 'Judecătoria Soroca',
  jbl: 'Judecătoria Bălți',
  jch: 'Judecătoria Cahul',
  jcm: 'Judecătoria Comrat',
  jed: 'Judecătoria Edineț',
  jhn: 'Judecătoria Hîncești',
  jun: 'Judecătoria Ungheni',
  jor: 'Judecătoria Orhei',
  jcs: 'Judecătoria Căușeni',
  jst: 'Judecătoria Strășeni',
  jan: 'Judecătoria Anenii Noi',
  cac: 'Curtea de Apel Chișinău',
  cab: 'Curtea de Apel Bălți',
  cach: 'Curtea de Apel Cahul'
};

// Instante cu domeniu inexistent (DNS NXDOMAIN) - excluse din lista default
// jcl: 'Judecătoria Călărași' - domeniu inexistent
// jri: 'Judecătoria Rezina' - domeniu inexistent

export const TOATE_INSTANTELE = Object.keys(INSTANTE);

export const COLOANE_SEDINTA = [
  'numar_dosar',
  'judecator',
  'data_sedinta',
  'ora',
  'sala',
  'denumire_dosar',
  'obiect_cauza',
  'tip_dosar',
  'tip_sedinta',
  'rezultat',
  'pdf_link'
];

// Fields that we track for modifications
export const CAMPURI_MONITORIZATE = [
  'judecator',
  'data_sedinta',
  'ora',
  'sala',
  'rezultat',
  'tip_sedinta'
];
