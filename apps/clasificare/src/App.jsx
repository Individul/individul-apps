import { useState } from 'react'
import infractiuniData from './data/infractiuni.json'
import {
  CATEGORII,
  CATEGORII_VARSTA,
  FRACTIUNI_ART_91_REDUSE,
  FRACTIUNI_ART_91_ADULT,
  FRACTIUNI_ART_92
} from './utils/constants.js'
import {
  getCategorie,
  getCeaMaiGravaCategorie,
  calculeazaFractiuni,
  formatRezultat
} from './utils/calculations.js'
import Changelog, { ChangelogButton } from './components/Changelog'

const INFRACTIUNI = infractiuniData.infractiuni

// Grupăm infracțiunile după articol pentru dropdown
const articoleGrouped = INFRACTIUNI.reduce((acc, inf) => {
  if (!acc[inf.art]) {
    acc[inf.art] = []
  }
  acc[inf.art].push(inf)
  return acc
}, {})


// Sortăm articolele numeric
const articoleOptions = Object.keys(articoleGrouped).sort((a, b) => {
  const aNum = parseInt(a.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '')) || 0
  const bNum = parseInt(b.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '')) || 0
  if (aNum !== bNum) return aNum - bNum
  return a.localeCompare(b)
})

console.log('DEBUG: Total articole unice:', articoleOptions.length)

// Componenta pentru badge-ul categoriei
function CategorieBadge({ categorie, size = 'md', showDenumire = false }) {
  if (!categorie) return null

  const cat = CATEGORII[categorie]
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold text-white ${sizeClasses[size]}`}
      style={{ backgroundColor: cat.color }}
    >
      {categorie}
      {showDenumire && <span className="font-normal"> - {cat.denumire}</span>}
    </span>
  )
}

// Componenta pentru selectorul categoriei de vârstă
function VarstaSelector({ categorieVarsta, onChange }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Object.entries(CATEGORII_VARSTA).map(([key, info]) => (
        <label
          key={key}
          className={`relative flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
            categorieVarsta === key
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <input
            type="radio"
            name="categorieVarsta"
            value={key}
            checked={categorieVarsta === key}
            onChange={() => onChange(key)}
            className="sr-only"
          />
          <span className="text-2xl mb-1">
            {key === 'minor' && '👶'}
            {key === 'tanar' && '🧑'}
            {key === 'adult' && '👨'}
            {key === 'varstnic' && '👴'}
          </span>
          <span className="text-sm font-medium text-center text-gray-800">
            {info.denumire}
          </span>
          {info.beneficiazaReducere && (
            <span className="text-xs text-green-600 mt-1">
              Fracții reduse
            </span>
          )}
        </label>
      ))}
    </div>
  )
}

// Componenta principală
function App() {
  const [articolSelectat, setArticolSelectat] = useState('')
  const [cautaArticol, setCautaArticol] = useState('')
  const [alineatSelectat, setAlineatSelectat] = useState('')
  const [infractiuniAdaugate, setInfractiuniAdaugate] = useState([])
  const [eroare, setEroare] = useState('')
  const [rezultat, setRezultat] = useState(null)

  // Categoria de vârstă - implicit adult
  const [categorieVarsta, setCategorieVarsta] = useState('adult')

  // Categoria determinată din articole (pentru Calculator Termene)
  const [categorieDeterminata, setCategorieDeterminata] = useState(null)

  // === Calculator Termene - State ===
  const [dataInceputPedeapsa, setDataInceputPedeapsa] = useState('')
  const [termenAni, setTermenAni] = useState('')
  const [termenLuni, setTermenLuni] = useState('')
  const [termenZile, setTermenZile] = useState('')
  const [arestPreventivActiv, setArestPreventivActiv] = useState(false)
  const [dataInceputArest, setDataInceputArest] = useState('')
  const [dataSfarsitArest, setDataSfarsitArest] = useState('')
  const [rezultatTermene, setRezultatTermene] = useState(null)

  // === Changelog ===
  const [showChangelog, setShowChangelog] = useState(false)

  // === Calculator Termene - Funcții ===

  // ═══════════════════════════════════════════════════════════════
  // UTILITARE DATE
  // ═══════════════════════════════════════════════════════════════

  // Format dată DD.MM.YYYY sau YYYY-MM-DD -> Date
  const parseData = (dataStr) => {
    if (!dataStr) return null

    // Format YYYY-MM-DD (HTML5 date input)
    if (dataStr.includes('-')) {
      const parts = dataStr.split('-')
      if (parts.length !== 3) return null
      const [an, luna, zi] = parts.map(p => parseInt(p))
      if (isNaN(zi) || isNaN(luna) || isNaN(an)) return null
      return new Date(an, luna - 1, zi)
    }

    // Format DD.MM.YYYY
    const parts = dataStr.split('.')
    if (parts.length !== 3) return null
    const [zi, luna, an] = parts.map(p => parseInt(p))
    if (isNaN(zi) || isNaN(luna) || isNaN(an)) return null
    return new Date(an, luna - 1, zi)
  }

  // Format Date -> DD.MM.YYYY
  const formatData = (date) => {
    if (!date) return ''
    const zi = String(date.getDate()).padStart(2, '0')
    const luna = String(date.getMonth() + 1).padStart(2, '0')
    const an = date.getFullYear()
    return `${zi}.${luna}.${an}`
  }

  // Format Date -> YYYY-MM-DD (pentru input type="date")
  const formatDataInput = (date) => {
    if (!date) return ''
    const zi = String(date.getDate()).padStart(2, '0')
    const luna = String(date.getMonth() + 1).padStart(2, '0')
    const an = date.getFullYear()
    return `${an}-${luna}-${zi}`
  }

  // ═══════════════════════════════════════════════════════════════
  // REGULI JURIDICE RM - CALCUL TERMENE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Adaugă termen la o dată conform regulilor juridice RM.
   *
   * REGULI JURIDICE RM:
   * - Pentru termeni în ani: expiră în ziua din anul final care PRECEDE ziua de început
   *   Exemplu: 15.05.1996 + 1 an = 14.05.1997
   * - Pentru termeni în luni: expiră în ziua lunii care PRECEDE ziua de început
   *   Exemplu: 05.01.1997 + 6 luni = 04.07.1997
   * - Pentru termeni mixți (ani + luni + zile): calcul calendaristic complet
   *   Exemplu: 26.06.2020 + 1 an 4 luni 21 zile = 16.11.2021
   *
   * @param {Date} data - Data de start
   * @param {number} ani - Ani de adăugat
   * @param {number} luni - Luni de adăugat
   * @param {number} zile - Zile de adăugat
   * @param {boolean} scade1Zi - Dacă true, scade 1 zi la final (pentru sfârșitul termenului)
   * @returns {Date} - Data calculată
   */
  const adaugaTermen = (data, ani = 0, luni = 0, zile = 0, scade1Zi = false) => {
    const rez = new Date(data)
    const ziInceput = rez.getDate()

    // Adăugăm anii
    if (ani > 0) {
      rez.setFullYear(rez.getFullYear() + ani)
    }

    // Adăugăm lunile
    if (luni > 0) {
      rez.setMonth(rez.getMonth() + luni)
    }

    // Adăugăm zilele
    if (zile > 0) {
      rez.setDate(rez.getDate() + zile)
    }

    // REGULĂ RM: scădem 1 zi pentru termeni doar în ani sau doar în luni
    // (nu și pentru termeni mixți care includ și zile)
    if (scade1Zi) {
      rez.setDate(rez.getDate() - 1)
    }

    return rez
  }

  /**
   * Calculează termenul final conform regulilor juridice RM.
   * Pentru sfârșitul termenului, scădem întotdeauna 1 zi.
   *
   * @param {Date} dataInceput - Data începutului
   * @param {number} ani - Ani
   * @param {number} luni - Luni
   * @param {number} zile - Zile
   * @returns {Date} - Data sfârșitului
   */
  const calculeazaTermenFinal = (dataInceput, ani, luni, zile) => {
    // Pentru sfârșitul termenului, scădem întotdeauna 1 zi conform regulilor RM
    return adaugaTermen(dataInceput, ani, luni, zile, true)
  }

  /**
   * Calculează fracția din termen păstrând structura ani/luni/zile.
   * Fracția se calculează din termenul TOTAL stabilit în sentință.
   *
   * @param {number} ani - Ani din termen
   * @param {number} luni - Luni din termen
   * @param {number} zile - Zile din termen
   * @param {string} fractie - Fracția (ex: "1/2", "2/3")
   * @returns {Object} - { ani, luni, zile, zileTotale }
   */
  const calculeazaFracțieDinTermen = (ani, luni, zile, fractie) => {
    const [numarator, numitor] = fractie.split('/').map(Number)

    // Convertim totul în luni pentru calcul (1 an = 12 luni)
    // Dacă zile > 15, considerăm o lună întreagă
    const luniTotale = ani * 12 + luni + (zile >= 15 ? 1 : 0)
    const luniFracțieTotal = Math.ceil((luniTotale * numarator) / numitor)

    // Convertim înapoi în ani/luni pentru afișare (fără zile reziduale)
    const aniFracție = Math.floor(luniFracțieTotal / 12)
    const luniFracție = luniFracțieTotal % 12

    // Pentru zileTotale (folosit în alte calcule), folosim 30 zile/lună
    const zileTotale = aniFracție * 365 + luniFracție * 30

    return {
      ani: aniFracție,
      luni: luniFracție,
      zile: 0, // Nu mai avem zile reziduale
      zileTotale: zileTotale
    }
  }

  /**
   * Calculează data la care se adaugă termenul în ani/luni/zile.
   * Folosește calcul calendaristic complet pentru fracțiuni.
   *
   * @param {Date} data - Data de start
   * @param {number} ani - Ani de adăugat
   * @param {number} luni - Luni de adăugat
   * @param {number} zile - Zile de adăugat
   * @returns {Date} - Data calculată
   */
  const adugaTermenCalendaristic = (data, ani, luni, zile) => {
    const rez = new Date(data)

    // Adăugăm anii
    if (ani > 0) {
      rez.setFullYear(rez.getFullYear() + ani)
    }

    // Adăugăm lunile
    if (luni > 0) {
      rez.setMonth(rez.getMonth() + luni)
    }

    // Adăugăm zilele
    if (zile > 0) {
      rez.setDate(rez.getDate() + zile)
    }

    return rez
  }

  /**
   * Calculează diferența în zile între două date (calendaristic).
   *
   * @param {Date} data1 - Data start
   * @param {Date} data2 - Data sfârșit
   * @returns {number} - Numărul de zile
   */
  const diferențăZile = (data1, data2) => {
    const unZi = 24 * 60 * 60 * 1000
    return Math.round((data2 - data1) / unZi)
  }

  /**
   * Calculează termenul în zile totale (pentru afișare).
   * 1 an = 365 zile, 1 lună = 30 zile
   */
  const termenInZile = () => {
    const ani = parseInt(termenAni) || 0
    const luni = parseInt(termenLuni) || 0
    const zile = parseInt(termenZile) || 0
    return ani * 365 + luni * 30 + zile
  }

  // ═══════════════════════════════════════════════════════════════
  // CALCUL REZULTAT TERMENE - CONFORM REGULILOR RM
  // ═══════════════════════════════════════════════════════════════
  //
  // FORMULE (conform specificațiilor utilizator):
  //
  // 1. Data eligibilității pentru eliberare condiționată:
  //    data_eligibilitate = data_început + (termen_total × fracție) - arest_preventiv
  //
  // 2. Data sfârșitului termenului:
  //    data_sfârșit = data_început + termen_total - arest_preventiv - 1 zi
  //
  // 3. Perioada arestului preventiv se scade atât din fracție cât și din sfârșitul termenului
  //
  // ═══════════════════════════════════════════════════════════════

  // Calculează rezultatul termenelor
  const calculeazaTermene = () => {
    console.log('calculeazaTermene apelat', { dataInceputPedeapsa, termenAni, termenLuni, termenZile })
    try {
      const erori = []

    // Validare date obligatorii
    const dataInceput = parseData(dataInceputPedeapsa)
    if (!dataInceput) {
      erori.push('Data începutului pedepsei este obligatorie')
    }

    const ani = parseInt(termenAni) || 0
    const luni = parseInt(termenLuni) || 0
    const zile = parseInt(termenZile) || 0

    const totalZile = ani * 365 + luni * 30 + zile
    if (totalZile < 1) {
      erori.push('Termenul de pedeapsă trebuie să fie cel puțin 1 zi')
    }

    // Validare categorie determinată (cel puțin un articol adăugat)
    if (!categorieDeterminata) {
      erori.push('Adăugați cel puțin un articol pentru a determina fracțiile corespunzătoare')
    }

    // Validare arest preventiv (dacă e activ)
    let zileArest = 0
    if (arestPreventivActiv) {
      const dataStart = parseData(dataInceputArest)
      const dataSfarsit = parseData(dataSfarsitArest)

      if (!dataStart || !dataSfarsit) {
        erori.push('Ambele date pentru arestul preventiv sunt obligatorii')
      } else if (dataSfarsit <= dataStart) {
        erori.push('Data finalizării arestului trebuie să fie după data începerii')
      } else {
        // Calculăm perioada arestului preventiv în zile calendaristice
        // Regulă [start, end): include ziua de început, exclude ziua de sfârșit
        // Exemplu: 29.01.2015 - 29.04.2015 = 90 zile
        zileArest = diferențăZile(dataStart, dataSfarsit)
      }
    }

    if (erori.length > 0) {
      setEroare(erori.join('. '))
      return
    }

    setEroare('')

    // 1. Obținem fracțiile - folosim categoriaDeterminata (actualizată automat la adăugare articole)
    let categorie = categorieDeterminata

    // Determinăm fracțiile corecte în funcție de categorie și vârstă
    let fractie91, fractie92

    if (categorie) {
      // Calculăm direct din constants - depinde de categorie și vârstă
      const beneficiazaReducere = CATEGORII_VARSTA[categorieVarsta].beneficiazaReducere
      fractie91 = beneficiazaReducere ? FRACTIUNI_ART_91_REDUSE[categorie] : FRACTIUNI_ART_91_ADULT[categorie]
      fractie92 = FRACTIUNI_ART_92[categorie]
    } else {
      // Nu avem categorie - fracții implicite
      fractie91 = '1/2'
      fractie92 = '1/2'
    }

    console.log('DEBUG Termene:', { categorie, categorieVarsta, fractie91, fractie92 })

    // ═══════════════════════════════════════════════════════════════
    // CALCULUL ART. 91 - LIBERARE CONDIȚIONATĂ
    // ═══════════════════════════════════════════════════════════════
    // Formula: fraction_raw_date = start_date + durata_fracției
    // Apoi scădem arestul preventiv

    // 1. Calculăm fracția din termenul total (păstrând structura ani/luni/zile)
    const fractie91Termen = calculeazaFracțieDinTermen(ani, luni, zile, fractie91)

    // 2. Adăugăm fracția la data începutului (calcul calendaristic)
    const dataFracție91Raw = adugaTermenCalendaristic(
      dataInceput,
      fractie91Termen.ani,
      fractie91Termen.luni,
      fractie91Termen.zile
    )

    // 3. Scădem arestul preventiv din data fracției
    const dataEligibilitate91 = new Date(dataFracție91Raw)
    dataEligibilitate91.setDate(dataEligibilitate91.getDate() - zileArest)

    // 4. Calculăm zilele rămase de executat (fracție - arest)
    const zileArt91 = Math.max(1, fractie91Termen.zileTotale - zileArest)

    // ═══════════════════════════════════════════════════════════════
    // CALCULUL ART. 92 - ÎNLOCUIRE PĂRȚII NEEXECUTATE
    // ═══════════════════════════════════════════════════════════════

    // 1. Calculăm fracția din termenul total
    const fractie92Termen = calculeazaFracțieDinTermen(ani, luni, zile, fractie92)

    // 2. Adăugăm fracția la data începutului
    const dataFracție92Raw = adugaTermenCalendaristic(
      dataInceput,
      fractie92Termen.ani,
      fractie92Termen.luni,
      fractie92Termen.zile
    )

    // 3. Scădem arestul preventiv
    const dataEligibilitate92 = new Date(dataFracție92Raw)
    dataEligibilitate92.setDate(dataEligibilitate92.getDate() - zileArest)

    // 4. Calculăm zilele rămase de executat
    const zileArt92 = Math.max(1, fractie92Termen.zileTotale - zileArest)

    // ═══════════════════════════════════════════════════════════════
    // CALCULUL SFÂRȘITULUI TERMENULUI
    // ═══════════════════════════════════════════════════════════════
    // Formula: data_sfârșit = data_început + termen_total - arest_preventiv - 1 zi

    // 1. Adăugăm termenul total la data începutului
    const dataTermenRaw = adugaTermenCalendaristic(dataInceput, ani, luni, zile)

    // 2. Scădem arestul preventiv
    const dataTermenFaraArest = new Date(dataTermenRaw)
    dataTermenFaraArest.setDate(dataTermenFaraArest.getDate() - zileArest)

    // 3. Scădem 1 zi conform regulilor RM pentru sfârșitul termenului
    const dataEliberareDefinitivă = new Date(dataTermenFaraArest)
    dataEliberareDefinitivă.setDate(dataEliberareDefinitivă.getDate() - 1)

    // 4. Calculăm termenul total efectiv (inclusiv arestul preventiv scăzut)
    const termenTotalZile = totalZile - zileArest

    setRezultatTermene({
      dataInceput: formatData(dataInceput),
      termenTotal: { ani, luni, zile },
      termenTotalZile: totalZile,
      dataTermenFinalCalculat: formatData(dataEliberareDefinitivă),
      arestPreventiv: arestPreventivActiv ? {
        activ: true,
        dataInceput: formatData(parseData(dataInceputArest)),
        dataSfarsit: formatData(parseData(dataSfarsitArest)),
        zile: zileArest
      } : { activ: false, zile: 0 },
      dataEliberareDefinitivă: formatData(dataEliberareDefinitivă),
      categorie: categorie,
      art91: {
        fractie: fractie91,
        zile: zileArt91,
        data: formatData(dataEligibilitate91),
        termenFracție: fractie91Termen  // includem termenul fracției pentru afișare
      },
      art92: {
        fractie: fractie92,
        zile: zileArt92,
        data: formatData(dataEligibilitate92),
        termenFracție: fractie92Termen
      }
    })
    } catch (error) {
      console.error('Eroare la calculul termenelor:', error)
      setEroare(`Eroare la calcul: ${error.message}`)
    }
  }

  // Reset calculator termene
  const resetTermene = () => {
    setDataInceputPedeapsa('')
    setTermenAni('')
    setTermenLuni('')
    setTermenZile('')
    setArestPreventivActiv(false)
    setDataInceputArest('')
    setDataSfarsitArest('')
    setRezultatTermene(null)
    setEroare('')
  }

  // Filtrăm articolele după căutare
  const articoleFiltrate = cautaArticol
    ? articoleOptions.filter(art =>
        art.toLowerCase().includes(cautaArticol.toLowerCase())
      )
    : articoleOptions

  // Alineate disponibile pentru articolul selectat
  const alineateDisponibile = articolSelectat
    ? articoleGrouped[articolSelectat]?.sort((a, b) => parseInt(a.alin) - parseInt(b.alin)) || []
    : []

  // Verificăm dacă articolul are variante fără alineat (alin = "0")
  const articolFaraAlineat = (art) => {
    const alin = articoleGrouped[art]
    return alin && alin.some(a => a.alin === "0")
  }

  // Handler pentru selectarea articolului
  const handleArticolChange = (value) => {
    setArticolSelectat(value)
    setCautaArticol('')  // Resetăm căutarea după selectare
    // Resetăm alineatul și selectăm primul disponibil
    setAlineatSelectat('')
    // Dacă articolul are o singură variantă, o selectăm automat
    const alineate = articoleGrouped[value]
    if (alineate && alineate.length === 1) {
      setAlineatSelectat(alineate[0].alin)
    }
    // Dacă articolul are doar variantă "0" (fără alineat), o selectăm automat
    if (alineate && alineate.length === 1 && alineate[0].alin === "0") {
      setAlineatSelectat("0")
    }
  }

  // Handler pentru căutare articol
  const handleCautaArticol = (value) => {
    setCautaArticol(value)
    // Dacă valoarea se potrivește exact cu un articol, îl selectăm
    const match = articoleOptions.find(art => art.toLowerCase() === value.toLowerCase())
    if (match) {
      setArticolSelectat(match)
    } else {
      setArticolSelectat('')
    }
  }

  // Handler pentru selectarea alineatului
  const handleAlineatChange = (value) => {
    setAlineatSelectat(value)
  }

  // Adăugare infracțiune
  const handleAdauga = () => {
    setEroare('')

    if (!articolSelectat) {
      setEroare('Selectați un articol.')
      return
    }

    if (!alineatSelectat) {
      setEroare('Selectați un alineat.')
      return
    }

    const infractiune = getCategorie(articolSelectat, alineatSelectat, INFRACTIUNI)
    if (!infractiune) {
      setEroare(`Art. ${articolSelectat} alin. ${alineatSelectat} nu a fost găsit în baza de date.`)
      return
    }

    // Verificăm dacă nu există deja
    const exista = infractiuniAdaugate.some(
      i => i.art === infractiune.art && i.alin === infractiune.alin
    )
    if (exista) {
      setEroare('Această infracțiune este deja adăugată.')
      return
    }

    const nouLista = [...infractiuniAdaugate, infractiune]
    setInfractiuniAdaugate(nouLista)

    // Calculăm categoria determinată pentru Calculator Termene
    const { categorie: cat } = getCeaMaiGravaCategorie(nouLista)
    setCategorieDeterminata(cat)

    // Resetăm selecția
    setArticolSelectat('')
    setAlineatSelectat('')
    setCautaArticol('')

    // Dacă avem rezultat, îl recalculăm automat
    if (rezultat) {
      handleCalculeaza(true)
    }
  }

  // Eliminare infracțiune
  const handleElimina = (index) => {
    const nouLista = infractiuniAdaugate.filter((_, i) => i !== index)
    setInfractiuniAdaugate(nouLista)

    // Actualizăm categoria determinată pentru Calculator Termene
    if (nouLista.length === 0) {
      setCategorieDeterminata(null)
      setRezultat(null)
    } else {
      const { categorie: cat } = getCeaMaiGravaCategorie(nouLista)
      setCategorieDeterminata(cat)
      if (rezultat) {
        setTimeout(() => handleCalculeaza(true), 0)
      }
    }
  }

  // Calcul rezultat
  const handleCalculeaza = (silent = false) => {
    if (infractiuniAdaugate.length === 0) {
      if (!silent) setEroare('Adăugați cel puțin o infracțiune.')
      return
    }

    const { categorie, articolDeterminant, infractiuneDeterminanta } =
      getCeaMaiGravaCategorie(infractiuniAdaugate)

    const { art91, art92 } = calculeazaFractiuni(categorie, categorieVarsta)

    setRezultat({
      categorie,
      art91,
      art92,
      articolDeterminant,
      infractiuneDeterminanta,
      infractiuni: infractiuniAdaugate,
      categorieVarsta
    })
    if (!silent) setEroare('')
  }

  // Copiere rezultat
  const handleCopiere = () => {
    if (!rezultat) return
    navigator.clipboard.writeText(formatRezultat(rezultat))
    alert('Rezultatul a fost copiat în clipboard!')
  }

  // Export PDF (simplificat - se deschide fereastră de print)
  const handleExportPDF = () => {
    if (!rezultat) return
    window.print()
  }

  // Resetare
  const handleReset = () => {
    setInfractiuniAdaugate([])
    setRezultat(null)
    setCategorieDeterminata(null)
    setEroare('')
    setArticolSelectat('')
    setAlineatSelectat('')
    setCautaArticol('')
    setCategorieVarsta('adult')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            <span className="text-blue-600">⚖️</span> Calculator Fracțiuni
          </h1>
          <p className="text-gray-600 text-lg">
            Liberarea condiționată înainte de termen și înlocuirea părții neexecutate din pedeapsă cu o pedeapsă mai blândă (Art. 91, 92 CP RM)
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Codul Penal al Republicii Moldova
          </p>
        </header>

        {/* Card Principal */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">👤</span>
            Vârsta condamnatului la momentul săvârșirii infracțiunii
          </h2>

          <VarstaSelector
            categorieVarsta={categorieVarsta}
            onChange={setCategorieVarsta}
          />

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Selectat:</strong> {CATEGORII_VARSTA[categorieVarsta].denumire}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {CATEGORII_VARSTA[categorieVarsta].descriere}
            </p>
          </div>
        </div>

        {/* Card Adăugare Infracțiuni */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">📝</span>
            Adăugare Infracțiuni
          </h2>

          {/* Input Section */}
          <div className="mb-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Selector Articol - cu căutare */}
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Articol
                </label>
                <input
                  type="text"
                  id="articol-input"
                  value={cautaArticol || articolSelectat || ''}
                  onChange={(e) => handleCautaArticol(e.target.value)}
                  onFocus={(e) => {
                    e.target.select()
                    if (articolSelectat) {
                      setCautaArticol(articolSelectat)
                    }
                  }}
                  placeholder="Caută articolul..."
                  className="w-full input-field"
                  autoComplete="off"
                />
              </div>

              {/* Selector Alineat */}
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alineat
                </label>
                <select
                  value={alineatSelectat}
                  onChange={(e) => handleAlineatChange(e.target.value)}
                  disabled={!articolSelectat}
                  className="w-full input-field disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">-- Selectează --</option>
                  {/* Opțiunea "Fără alineat" dacă articolul are alin = "0" */}
                  {articolFaraAlineat(articolSelectat) && (
                    <option value="0">Fără alineat (Articol integral)</option>
                  )}
                  {alineateDisponibile
                    .filter(al => al.alin !== "0")  // Nu afișăm "0" în lista normală
                    .map(al => (
                    <option key={al.alin} value={al.alin}>
                      ({al.alin}) {al.pedeapsa_max} - {al.cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buton Adaugă */}
              <div className="flex items-end">
                <button
                  onClick={handleAdauga}
                  disabled={!articolSelectat || !alineatSelectat}
                  className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ height: '42px' }}
                >
                  <span>+ Adaugă</span>
                </button>
              </div>
            </div>

            {/* Dropdown suggestions - positioned outside */}
            {cautaArticol && articoleFiltrate.length > 0 && (
              <div className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                   style={{ width: '33.33%', maxWidth: '400px', marginTop: '4px' }}>
                {articoleFiltrate.slice(0, 50).map(art => (
                  <button
                    key={art}
                    type="button"
                    onClick={() => handleArticolChange(art)}
                    className={`w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors ${
                      art === articolSelectat ? 'bg-blue-100 font-semibold' : ''
                    }`}
                  >
                    {art}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info articol selectat */}
          {articolSelectat && alineatSelectat && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Selectat:</strong>{' '}
                {alineatSelectat === "0" ? (
                  <>Art. {articolSelectat} CP RM (fără alineat)</>
                ) : (
                  <>Art. {articolSelectat}, alin. ({alineatSelectat})</>
                )}
                {(() => {
                  const inf = INFRACTIUNI.find(i => i.art === articolSelectat && i.alin === alineatSelectat)
                  return inf ? (
                    <span className="ml-2">
                      - <span className="font-semibold">{inf.cat}</span> - {inf.pedeapsa_max}
                    </span>
                  ) : null
                })()}
              </p>
            </div>
          )}

          {/* Eroare */}
          {eroare && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {eroare}
            </div>
          )}

          {/* Lista infracțiuni adăugate */}
          {infractiuniAdaugate.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Infracțiuni adăugate ({infractiuniAdaugate.length}):
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {infractiuniAdaugate.map((inf, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
                  >
                    <div className="flex-1">
                      <span className="font-semibold">Art. {inf.art}</span>
                      {inf.alin === "0" ? (
                        <span className="text-gray-500 italic"> (fără alineat)</span>
                      ) : (
                        <span className="text-gray-500"> alin. {inf.alin}</span>
                      )}
                      <span className="text-gray-600 ml-2 hidden sm:inline">
                        - {inf.denumire}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CategorieBadge categorie={inf.cat} size="sm" />
                      <button
                        onClick={() => handleElimina(idx)}
                        className="text-red-500 hover:text-red-700 font-bold ml-2 text-lg"
                        title="Elimină"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Butoane acțiuni */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleReset}
              className="btn-secondary"
            >
              Resetare
            </button>
          </div>
        </div>

        {/* =========================================
             CALCULATOR TERMENE
             ========================================= */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">📅</span>
              Calculator Termene
            </h2>
            {rezultatTermene && (
              <button
                onClick={resetTermene}
                className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg"
              >
                Resetare
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coloana stângă - Date intrare */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-700 border-b pb-2">Date de intrare</h3>

              {/* Data început pedeapsă */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Începutul termenului de pedeapsă *
                </label>
                <input
                  type="date"
                  value={dataInceputPedeapsa}
                  onChange={(e) => setDataInceputPedeapsa(e.target.value)}
                  className="w-full input-field"
                />
              </div>

              {/* Termen de pedeapsă */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Termen de pedeapsă *
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={termenAni}
                      onChange={(e) => setTermenAni(e.target.value)}
                      placeholder="Ani"
                      min="0"
                      className="w-full input-field"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={termenLuni}
                      onChange={(e) => setTermenLuni(e.target.value)}
                      placeholder="Luni"
                      min="0"
                      className="w-full input-field"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={termenZile}
                      onChange={(e) => setTermenZile(e.target.value)}
                      placeholder="Zile"
                      min="0"
                      className="w-full input-field"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {termenInZile() > 0 ? `Total: ${termenInZile()} zile` : 'Minim 1 zi'}
                </p>
              </div>

              {/* Arest preventiv */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={arestPreventivActiv}
                    onChange={(e) => setArestPreventivActiv(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Include perioada arestului preventiv
                  </span>
                </label>

                {arestPreventivActiv && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Data începerii arestului</label>
                      <input
                        type="date"
                        value={dataInceputArest}
                        onChange={(e) => setDataInceputArest(e.target.value)}
                        className="w-full input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Data finalizării arestului</label>
                      <input
                        type="date"
                        value={dataSfarsitArest}
                        onChange={(e) => setDataSfarsitArest(e.target.value)}
                        className="w-full input-field"
                      />
                    </div>
                    {dataInceputArest && dataSfarsitArest && (
                      <p className="text-xs text-blue-600">
                        Perioadă calculată: {diferențăZile(parseData(dataInceputArest), parseData(dataSfarsitArest))} zile
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Buton calcul */}
              <button
                onClick={calculeazaTermene}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <span>🔍</span>
                <span>Calculează termenele</span>
              </button>
            </div>

            {/* Coloana dreaptă - Rezultate */}
            <div>
              {rezultatTermene ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-medium text-gray-700">Rezultat calcul</h3>
                    <div className="flex gap-2 no-print">
                      <button
                        onClick={() => {
                          const formatTermenFracție = (tf) => {
                            if (!tf) return ''
                            let parts = []
                            if (tf.ani > 0) parts.push(`${tf.ani} ani`)
                            if (tf.luni > 0) parts.push(`${tf.luni} luni`)
                            if (tf.zile > 0) parts.push(`${tf.zile} zile`)
                            return parts.join(', ')
                          }

                          const text = `CALCULATOR TERMENE - CP RM\n` +
                            `═══════════════════════════════════════\n\n` +
                            `📋 DATE DE INTRARE:\n` +
                            `• Data început pedeapsă: ${rezultatTermene.dataInceput}\n` +
                            `• Termen: ${rezultatTermene.termenTotal.ani} ani, ${rezultatTermene.termenTotal.luni} luni, ${rezultatTermene.termenTotal.zile} zile\n` +
                            `• Termen total: ${rezultatTermene.termenTotalZile} zile\n` +
                            `${rezultatTermene.arestPreventiv.activ ? `• Arest preventiv: ${rezultatTermene.arestPreventiv.zile} zile (${rezultatTermene.arestPreventiv.dataInceput} - ${rezultatTermene.arestPreventiv.dataSfarsit})\n` : ''}\n` +
                            `═══════════════════════════════════════\n\n` +
                            `📅 DATA SFÂRȘITULUI TERMENULUI:\n` +
                            `• Data eliberării definitive: ${rezultatTermene.dataEliberareDefinitivă}\n\n` +
                            `═══════════════════════════════════════\n\n` +
                            `✅ ART. 91 - LIBERARE CONDIȚIONATĂ:\n` +
                            `• Fracție: ${rezultatTermene.art91.fractie}\n` +
                            `• Calcul fracție: ${formatTermenFracție(rezultatTermene.art91.termenFracție)}\n` +
                            `• Zile de executat: ${rezultatTermene.art91.zile} zile\n` +
                            `• Data eligibilității: ${rezultatTermene.art91.data}\n\n` +
                            `═══════════════════════════════════════\n\n` +
                            `✅ ART. 92 - ÎNLOCUIRE PĂRȚII NEEXECUTATE:\n` +
                            `• Fracție: ${rezultatTermene.art92.fractie}\n` +
                            `• Calcul fracție: ${formatTermenFracție(rezultatTermene.art92.termenFracție)}\n` +
                            `• Zile de executat: ${rezultatTermene.art92.zile} zile\n` +
                            `• Data înlocuirii: ${rezultatTermene.art92.data}\n\n` +
                            `═══════════════════════════════════════\n` +
                            `Generat cu Calculator Termene RM`
                          navigator.clipboard.writeText(text)
                          alert('Rezultatul a fost copiat!')
                        }}
                        className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg"
                      >
                        📋 Copiază
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg"
                      >
                        🖨️ Print
                      </button>
                    </div>
                  </div>

                  {/* Detalii calcul */}
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <p className="font-medium text-gray-700">📋 Detalii calcul:</p>
                    <p>• Data început: <span className="font-semibold">{rezultatTermene.dataInceput}</span></p>
                    <p>• Termen: <span className="font-semibold">{rezultatTermene.termenTotal.ani} ani, {rezultatTermene.termenTotal.luni} luni, {rezultatTermene.termenTotal.zile} zile</span></p>
                    <p>• Termen total: <span className="font-semibold">{rezultatTermene.termenTotalZile} zile</span></p>
                    {rezultatTermene.arestPreventiv.activ && (
                      <p>• Arest preventiv: <span className="font-semibold text-orange-700">-{rezultatTermene.arestPreventiv.zile} zile</span></p>
                    )}
                    <p>• Termen efectiv: <span className="font-semibold">{rezultatTermene.termenTotalZile - rezultatTermene.arestPreventiv.zile} zile</span></p>
                    <p>• Data sfârșit: <span className="font-semibold">{rezultatTermene.dataTermenFinalCalculat}</span></p>
                  </div>

                  {/* Arest preventiv */}
                  {rezultatTermene.arestPreventiv.activ && (
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Arest preventiv (scăzut din calcul)</p>
                          <p className="font-semibold text-orange-700">
                            {rezultatTermene.arestPreventiv.dataInceput} → {rezultatTermene.arestPreventiv.dataSfarsit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Perioadă</p>
                          <p className="font-bold text-xl text-orange-700">
                            -{rezultatTermene.arestPreventiv.zile} zile
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ART. 91 - Liberare Condiționată */}
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-5">
                    <p className="text-xs text-green-700 font-medium mb-3">ART. 91 - LIBERARE CONDIȚIONATĂ</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Fracție aplicabilă</p>
                        <p className="font-bold text-4xl text-green-700">{rezultatTermene.art91.fractie}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Perioadă de executat</p>
                        <p className="font-bold text-2xl text-green-700">{rezultatTermene.art91.zile} zile</p>
                        <p className="text-xs text-gray-500">din {rezultatTermene.termenTotalZile} zile</p>
                      </div>
                    </div>
                    {rezultatTermene.art91.termenFracție && (
                      <div className="mt-2 text-xs text-gray-600 bg-green-100 rounded px-2 py-1">
                        <span className="font-medium">Calcul:</span> {rezultatTermene.art91.fractie} din {rezultatTermene.termenTotal.ani} ani {rezultatTermene.termenTotal.luni > 0 && `, ${rezultatTermene.termenTotal.luni} luni`} {rezultatTermene.termenTotal.zile > 0 && `, ${rezultatTermene.termenTotal.zile} zile`} = {rezultatTermene.art91.termenFracție.ani > 0 ? `${rezultatTermene.art91.termenFracție.ani} ani` : ''} {rezultatTermene.art91.termenFracție.luni > 0 ? `${rezultatTermene.art91.termenFracție.luni} luni` : ''} {rezultatTermene.art91.termenFracție.zile > 0 ? `${rezultatTermene.art91.termenFracție.zile} zile` : ''}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs text-gray-500">📅 DATA ELIGIBILITĂȚII</p>
                      <p className="text-2xl font-bold text-green-800">{rezultatTermene.art91.data}</p>
                    </div>
                  </div>

                  {/* ART. 92 - Înlocuire părții neexecutate */}
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-5">
                    <p className="text-xs text-blue-700 font-medium mb-3">ART. 92 - ÎNLOCUIRE PĂRȚII NEEXECUTATE</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Fracție aplicabilă</p>
                        <p className="font-bold text-4xl text-blue-700">{rezultatTermene.art92.fractie}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Perioadă de executat</p>
                        <p className="font-bold text-2xl text-blue-700">{rezultatTermene.art92.zile} zile</p>
                        <p className="text-xs text-gray-500">din {rezultatTermene.termenTotalZile} zile</p>
                      </div>
                    </div>
                    {rezultatTermene.art92.termenFracție && (
                      <div className="mt-2 text-xs text-gray-600 bg-blue-100 rounded px-2 py-1">
                        <span className="font-medium">Calcul:</span> {rezultatTermene.art92.fractie} din {rezultatTermene.termenTotal.ani} ani {rezultatTermene.termenTotal.luni > 0 && `, ${rezultatTermene.termenTotal.luni} luni`} {rezultatTermene.termenTotal.zile > 0 && `, ${rezultatTermene.termenTotal.zile} zile`} = {rezultatTermene.art92.termenFracție.ani > 0 ? `${rezultatTermene.art92.termenFracție.ani} ani` : ''} {rezultatTermene.art92.termenFracție.luni > 0 ? `${rezultatTermene.art92.termenFracție.luni} luni` : ''} {rezultatTermene.art92.termenFracție.zile > 0 ? `${rezultatTermene.art92.termenFracție.zile} zile` : ''}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs text-gray-500">📅 DATA ELIGIBILITĂȚII</p>
                      <p className="text-2xl font-bold text-blue-800">{rezultatTermene.art92.data}</p>
                    </div>
                  </div>

                  {/* Data eliberării definitive */}
                  <div className="bg-gray-200 rounded-lg p-4">
                    <p className="text-xs text-gray-600 mb-1">📅 DATA ELIBERĂRII DEFINITIVE (Sfârșitul termenului)</p>
                    <p className="text-xl font-bold text-gray-800">{rezultatTermene.dataEliberareDefinitivă}</p>
                  </div>

                  {/* Categoria determinată */}
                  {rezultatTermene.categorie && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Categoria determinată din articole</p>
                      <CategorieBadge categorie={rezultatTermene.categorie} size="md" showDenumire={true} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <div className="text-center">
                    <p className="text-4xl mb-2">📅</p>
                    <p>Completați datele pentru calcul</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabel fracții */}
        <div className="card mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            📐 Tabelul fracțiilor (conform CP RM):
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Categorie</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 bg-green-50">
                    Art. 91 (minor/18-21/60+)
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 bg-blue-50">
                    Art. 91 (adult 21-60)
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700 bg-purple-50">
                    Art. 92 (toți)
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(CATEGORII).map(([key, cat]) => (
                  <tr key={key} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <strong>{key}</strong> - {cat.denumire}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-green-700">
                      {FRACTIUNI_ART_91_REDUSE[key]}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-blue-700">
                      {FRACTIUNI_ART_91_ADULT[key]}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-purple-700">
                      {FRACTIUNI_ART_92[key]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center mt-8 text-sm text-gray-500">
          <p>
            Acesta este doar un instrument informativ și nu substituie consultarea actelor normative în vigoare.
          </p>
          <p className="mt-2">
            © Dumitru Prisăcaru, 2026
          </p>
        </footer>
      </div>

      {/* Changelog Button */}
      <ChangelogButton onClick={() => setShowChangelog(true)} />

      {/* Changelog Modal */}
      {showChangelog && <Changelog onClose={() => setShowChangelog(false)} />}
    </div>
  )
}

export default App
