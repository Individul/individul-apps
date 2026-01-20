import {
  ORDINE_GRAVITATE,
  FRACTIUNI_ART_91_ADULT,
  FRACTIUNI_ART_91_REDUSE,
  FRACTIUNI_ART_92,
  CATEGORII_VARSTA,
  getTemeiLegalArt91,
  getNotaArt91,
  TEMEI_LEGAL_ART_92
} from './constants.js';

/**
 * Parsează un articol care poate conține slash (ex: "217/1")
 * @param {string} articolInput - Input-ul utilizatorului (poate fi "217", "217/1", etc.)
 * @returns {Object} - { articol: string, alineatDinArticol: string|null }
 */
export function parseArticol(articolInput) {
  if (!articolInput) return { articol: '', alineatDinArticol: null };

  const parts = articolInput.split('/');
  return {
    articol: parts[0],
    alineatDinArticol: parts[1] || null
  };
}

/**
 * Normalizează un articol pentru căutare - încearcă toate variantele
 * @param {string} articol - Articolul principal
 * @param {string} alineat - Alineatul
 * @returns {Array} - Lista de variante de căutare
 */
export function getVarianteCautare(articol, alineat) {
  const variante = [];

  // Varianta 1: articol simplu + alineat (ex: "145" + "2")
  variante.push({ art: articol, alin: alineat });

  // Varianta 2: articol cu slash în baza de date (ex: "217/1" + "1")
  if (articol.match(/^\d+$/)) {
    // Putem avea articole de forma "217/1", "289/4" în baza de date
    // Încercăm să găsim orice articol care începe cu numărul dat
    variante.push({ artPrefix: articol, alin: alineat });
  }

  return variante;
}

/**
 * Întoarce categoria infracțiunii pe baza articolului și alineatului
 * @param {string} articol - Numărul articolului
 * @param {string} alineat - Numărul alineatului
 * @param {Array} infractiuni - Lista infracțiunilor din baza de date
 * @returns {Object|null} - Obiectul infracțiunii sau null dacă nu există
 */
export function getCategorie(articol, alineat, infractiuni) {
  // Căutare directă întâi
  let infractiune = infractiuni.find(
    i => i.art === articol && i.alin === alineat
  );

  if (infractiune) return infractiune;

  // Dacă nu s-a găsit, încercăm variante cu articol ce conține slash
  // ex: articol="217", alineat="1" poate fi găsit ca "217/1" + "1"
  if (articol.match(/^\d+$/)) {
    infractiune = infractiuni.find(i => {
      const artParts = i.art.split('/');
      const baseArt = artParts[0];
      const suffixArt = artParts[1]; // parte din articol după slash

      // Verificăm dacă articolul de bază se potrivește
      if (baseArt !== articol) return false;

      // Dacă articolul are suffix (ex: "217/1"), verificăm dacă alineatul se potrivește
      if (suffixArt) {
        // Articol e "217/1", alineat trebuie să fie "1"
        return i.alin === alineat;
      }

      // Articol simplu, verificăm doar alineatul
      return i.alin === alineat;
    });
  }

  return infractiune || null;
}

/**
 * Determină cea mai gravă categorie din mai multe infracțiuni
 * @param {Array} infractiuniAdaugate - Lista infracțiunilor adăugate
 * @returns {Object} - { categorie: string, articolDeterminant: string, infractiuneDeterminanta: Object }
 */
export function getCeaMaiGravaCategorie(infractiuniAdaugate) {
  if (!infractiuniAdaugate || infractiuniAdaugate.length === 0) {
    return { categorie: null, articolDeterminant: '', infractiuneDeterminanta: null };
  }

  let maxIndex = -1;
  let infractiuneDeterminanta = null;

  for (const inf of infractiuniAdaugate) {
    const index = ORDINE_GRAVITATE.indexOf(inf.cat);
    if (index > maxIndex) {
      maxIndex = index;
      infractiuneDeterminanta = inf;
    }
  }

  return {
    categorie: ORDINE_GRAVITATE[maxIndex],
    articolDeterminant: infractiuneDeterminanta ? `Art. ${infractiuneDeterminanta.art} alin. ${infractiuneDeterminanta.alin}` : '',
    infractiuneDeterminanta
  };
}

/**
 * Calculează fracțiunile pentru art. 91 și art. 92 în funcție de categorie și vârstă
 * @param {string} categorie - Categoria infracțiunii (U, MPG, G, DG, EG)
 * @param {string} categorieVarsta - Categoria de vârstă (minor, tanar, adult, varstnic)
 * @returns {Object} - {
 *   art91: { fractiune: string, temeiLegal: string, nota?: string },
 *   art92: { fractiune: string, temeiLegal: string }
 * }
 */
export function calculeazaFractiuni(categorie, categorieVarsta = 'adult') {
  if (!categorie) {
    return {
      art91: { fractiune: '-', temeiLegal: '-' },
      art92: { fractiune: '-', temeiLegal: '-' }
    };
  }

  const beneficiazaReducere = CATEGORII_VARSTA[categorieVarsta]?.beneficiazaReducere || false;

  // Art. 91 - depinde de vârstă
  const fractiune91 = beneficiazaReducere
    ? FRACTIUNI_ART_91_REDUSE[categorie]
    : FRACTIUNI_ART_91_ADULT[categorie];

  const temei91 = getTemeiLegalArt91(categorie, categorieVarsta);
  const nota91 = getNotaArt91(categorie, categorieVarsta);

  // Art. 92 - aceleași fracțiuni pentru toți
  const fractiune92 = FRACTIUNI_ART_92[categorie];
  const temei92 = TEMEI_LEGAL_ART_92;

  return {
    art91: {
      fractiune: fractiune91,
      temeiLegal: temei91,
      nota: nota91
    },
    art92: {
      fractiune: fractiune92,
      temeiLegal: temei92
    }
  };
}

/**
 * Calculează luna/ziile exacte când poate fi aplicată liberarea condiționată
 * @param {string} fractiune - Fracția (ex: "1/3", "1/2", etc.)
 * @param {number} luniTotale - Numărul total de luni ale pedepsei
 * @returns {Object} - { luni: number, zile: number, text: string }
 */
export function calculeazaLuniExecutate(fractiune, luniTotale) {
  if (!fractiune || !luniTotale || fractiune === '-') {
    return { luni: 0, zile: 0, text: '-' };
  }

  const [numarator, numitor] = fractiune.split('/').map(Number);
  const luniReq = Math.ceil((luniTotale * numarator) / numitor);

  const ani = Math.floor(luniReq / 12);
  const luni = luniReq % 12;

  let text = '';
  if (ani > 0) {
    text += `${ani} an${ani > 1 ? 'i' : ''}`;
  }
  if (luni > 0) {
    if (text) text += ' și ';
    text += `${luni} lun${luni > 1 ? 'i' : 'ă'}`;
  }
  if (!text) text = '0 luni';

  return { luni: luniReq, zile: luniReq * 30, text };
}

/**
 * Formează un text cu rezumatul rezultatului
 * @param {Object} rezultat - Rezultatul calculului
 * @returns {string} - Textul formatat
 */
export function formatRezultat(rezultat) {
  if (!rezultat.categorie) {
    return 'Nu au fost adăugate infracțiuni.';
  }

  const { categorie, art91, art92, articolDeterminant, categorieVarsta } = rezultat;
  const categorieVarstaInfo = CATEGORII_VARSTA[categorieVarsta];

  return `
=== REZULTAT CALCUL ===

Categoria de vârstă: ${categorieVarstaInfo.denumire}

Categoria cea mai gravă: ${categorie}
Determinată de: ${articolDeterminant}

Art. 91 - Liberarea condiționată:
Fracție necesară: ${art91.fractiune} din pedeapsă
Temei legal: ${art91.temeiLegal}
${art91.nota ? `Notă: ${art91.nota}` : ''}

Art. 92 - Înlocuirea părții neexecutate:
Fracție necesară: ${art92.fractiune} din pedeapsă
Temei legal: ${art92.temeiLegal}
  `.trim();
}

/**
 * Validare intrare articol/alineat
 * Acceptă formatul: articol simplu (ex: "145") sau cu slash (ex: "217/1")
 * @param {string} articol - Numărul articolului (poate conține slash)
 * @param {string} alineat - Numărul alineatului
 * @returns {Object} - { valid: boolean, eroare: string, parsed: { articol, alineat } }
 */
export function valideazaInfractiune(articol, alineat) {
  if (!articol || articol.trim() === '') {
    return { valid: false, eroare: 'Introduceți numărul articolului.' };
  }

  // Parsează articolul care poate conține slash (ex: "217/1")
  const { articol: articolBaza, alineatDinArticol } = parseArticol(articol);

  // Validează articolul de bază
  const artNum = parseInt(articolBaza);
  if (isNaN(artNum) || artNum < 1 || artNum > 999) {
    return { valid: false, eroare: 'Numărul articolului trebuie să fie între 1 și 999.' };
  }

  // Dacă articolul conține slash, folosim partea după slash ca alineat
  let alineatFinal = alineat;
  if (alineatDinArticol) {
    if (alineat && alineat.trim() !== '' && alineat !== alineatDinArticol) {
      return { valid: false, eroare: `Ați introdus articolul "${articol}" cu alineatul "${alineat}". Folosiți doar articolul sau doar alineatul separat.` };
    }
    alineatFinal = alineatDinArticol;
  }

  if (!alineatFinal || alineatFinal.trim() === '') {
    return { valid: false, eroare: 'Introduceți numărul alineatului.' };
  }

  const alinNum = parseInt(alineatFinal);
  if (isNaN(alinNum) || alinNum < 1 || alinNum > 99) {
    return { valid: false, eroare: 'Numărul alineatului trebuie să fie între 1 și 99.' };
  }

  return {
    valid: true,
    eroare: '',
    parsed: {
      articol: articolBaza,
      alineat: alineatFinal
    }
  };
}
