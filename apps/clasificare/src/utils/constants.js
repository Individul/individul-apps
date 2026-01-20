// Categoriile de infracțiuni conform art. 16 CP RM
export const CATEGORII = {
  U: { denumire: 'Ușoară', pedeapsaMax: '≤2 ani', ordine: 1, color: '#22c55e' },
  MPG: { denumire: 'Mai puțin gravă', pedeapsaMax: '≤5 ani', ordine: 2, color: '#3b82f6' },
  G: { denumire: 'Gravă', pedeapsaMax: '≤12 ani', ordine: 3, color: '#f97316' },
  DG: { denumire: 'Deosebit de gravă', pedeapsaMax: '>12 ani', ordine: 4, color: '#ef4444' },
  EG: { denumire: 'Excepțional de gravă', pedeapsaMax: 'Viață', ordine: 5, color: '#7c3aed' }
};

// ═══════════════════════════════════════════════════════════════
// CATEGORII DE VÂRSTĂ
// ═══════════════════════════════════════════════════════════════
export const CATEGORII_VARSTA = {
  minor: {
    key: 'minor',
    denumire: 'Minor (sub 18 ani)',
    descriere: 'Persoană care la momentul săvârșirii infracțiunii nu împlinise vârsta de 18 ani',
    beneficiazaReducere: true
  },
  tanar: {
    key: 'tanar',
    denumire: 'Tânăr (18-21 ani)',
    descriere: 'Persoană cu vârsta între 18 și 21 ani la momentul săvârșirii infracțiunii',
    beneficiazaReducere: true
  },
  adult: {
    key: 'adult',
    denumire: 'Adult (21-60 ani)',
    descriere: 'Persoană cu vârsta între 21 și 60 ani',
    beneficiazaReducere: false
  },
  varstnic: {
    key: 'varstnic',
    denumire: 'Vârstnic (peste 60 ani)',
    descriere: 'Persoană care a împlinit vârsta de 60 ani',
    beneficiazaReducere: true
  }
};

// ═══════════════════════════════════════════════════════════════
// FRACȚIUNILE PENTRU ART. 91 - Liberarea condiționată
// ═══════════════════════════════════════════════════════════════

// Pentru adulți (21-60 ani) - conform art. 91 alin. (4) CP RM
export const FRACTIUNI_ART_91_ADULT = {
  U: '1/2',   // alin. (4) lit. a)
  MPG: '1/2', // alin. (4) lit. a)
  G: '2/3',   // alin. (4) lit. b)
  DG: '2/3',  // alin. (4) lit. b)
  EG: '2/3'   // alin. (4) lit. b)
};

// Pentru minori, tineri (18-21) și vârstnici (60+) - conform art. 91 alin. (6) CP RM
export const FRACTIUNI_ART_91_REDUSE = {
  U: '1/3',   // alin. (6) lit. a)
  MPG: '1/3', // alin. (6) lit. a)
  G: '1/2',   // alin. (6) lit. b)
  DG: '2/3',  // alin. (6) lit. c)
  EG: '2/3'   // alin. (6) lit. c)
};

// ═══════════════════════════════════════════════════════════════
// FRACȚIUNILE PENTRU ART. 92 - Înlocuirea părții neexecutate
// ═══════════════════════════════════════════════════════════════

// Pentru toți - conform art. 92 alin. (2) CP RM
export const FRACTIUNI_ART_92 = {
  U: '1/3',   // alin. (2)
  MPG: '1/3', // alin. (2)
  G: '1/2',   // alin. (2)
  DG: '2/3',  // alin. (2)
  EG: '2/3'   // alin. (2)
};

// Nota: Pentru U și MPG la adulți (art. 91), minim 90 zile obligatoriu
export const MINIM_ZILE_U_MPG = 90;

// ═══════════════════════════════════════════════════════════════
// TEMEIURI LEGALE
// ═══════════════════════════════════════════════════════════════

// Obține temeiul legal pentru art. 91 în funcție de categorie și vârstă
export function getTemeiLegalArt91(categorie, categorieVarsta) {
  const beneficiazaReducere = CATEGORII_VARSTA[categorieVarsta].beneficiazaReducere;

  if (beneficiazaReducere) {
    // Minori, tineri 18-21, vârstnici 60+ - art. 91 alin. (6)
    const litera = (categorie === 'U' || categorie === 'MPG') ? 'a'
                 : (categorie === 'G') ? 'b' : 'c';
    return `art. 91 alin. (6) lit. ${litera}) CP RM`;
  } else {
    // Adulți 21-60 ani - art. 91 alin. (4)
    const litera = (categorie === 'U' || categorie === 'MPG') ? 'a' : 'b';
    return `art. 91 alin. (4) lit. ${litera}) CP RM`;
  }
}

// Obține nota pentru art. 91 (dacă există)
export function getNotaArt91(categorie, categorieVarsta) {
  const beneficiazaReducere = CATEGORII_VARSTA[categorieVarsta].beneficiazaReducere;

  if (!beneficiazaReducere && (categorie === 'U' || categorie === 'MPG')) {
    return 'Minim 90 de zile de închisoare obligatoriu';
  }
  return null;
}

// Temei legal pentru art. 92 (același pentru toți)
export const TEMEI_LEGAL_ART_92 = 'art. 92 alin. (2) CP RM';

// ═══════════════════════════════════════════════════════════════
// ALTE CONSTANTE
// ═══════════════════════════════════════════════════════════════

// Ordinea gravității pentru determinarea celei mai grave categorii
export const ORDINE_GRAVITATE = ['U', 'MPG', 'G', 'DG', 'EG'];
