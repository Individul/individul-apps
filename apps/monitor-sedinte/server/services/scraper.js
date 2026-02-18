import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import db from '../db/database.js';
import { INSTANTE, COLOANE_SEDINTA, CAMPURI_MONITORIZATE } from '../utils/constants.js';

const SCRAPE_DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS || '2000', 10);
const REQUEST_TIMEOUT_MS = 30000;

let isRunning = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateHash(instantaCod, numarDosar, dataSedinta, ora) {
  const str = `${instantaCod}|${numarDosar}|${dataSedinta}|${ora}`;
  return createHash('md5').update(str).digest('hex');
}

function parseDataToISO(dataDDMMYYYY) {
  if (!dataDDMMYYYY) return '';
  const parts = dataDDMMYYYY.trim().split('.');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export async function scrapeInstanta(codInstanta, numePersoana, tipDosar = 'Any') {
  const url = `https://${codInstanta}.instante.justice.md/ro/agenda-of-meetings?dossier_part=${encodeURIComponent(numePersoana)}&type=${tipDosar}&apply_filter=1`;
  const baseUrl = `https://${codInstanta}.instante.justice.md`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const sedinte = [];

    $('table tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 11) return;

      const sedinta = {};
      COLOANE_SEDINTA.forEach((col, i) => {
        if (col === 'pdf_link') {
          const link = $(cells[i]).find('a');
          if (link.length) {
            let href = link.attr('href') || '';
            if (href && !href.startsWith('http')) {
              href = baseUrl + (href.startsWith('/') ? '' : '/') + href;
            }
            sedinta[col] = href;
          } else {
            sedinta[col] = '';
          }
        } else {
          sedinta[col] = $(cells[i]).text().trim();
        }
      });

      sedinta.instanta_cod = codInstanta;
      sedinta.instanta_nume = INSTANTE[codInstanta] || codInstanta;
      sedinta.data_sedinta_iso = parseDataToISO(sedinta.data_sedinta);
      sedinta.hash_unic = generateHash(codInstanta, sedinta.numar_dosar, sedinta.data_sedinta, sedinta.ora);

      sedinte.push(sedinta);
    });

    return sedinte;
  } finally {
    clearTimeout(timeout);
  }
}

export async function scrapePersoana(persoana) {
  const instante = JSON.parse(persoana.instante);
  const rezultat = { gasite: 0, noi: 0, modificate: 0, erori: [] };

  const stmtSelect = db.prepare('SELECT * FROM sedinte WHERE hash_unic = ?');
  const stmtInsert = db.prepare(`
    INSERT INTO sedinte (hash_unic, persoana_id, instanta_cod, instanta_nume, numar_dosar, judecator,
      data_sedinta, data_sedinta_iso, ora, sala, denumire_dosar, obiect_cauza, tip_dosar, tip_sedinta,
      rezultat, pdf_link, ultima_verificare)
    VALUES (@hash_unic, @persoana_id, @instanta_cod, @instanta_nume, @numar_dosar, @judecator,
      @data_sedinta, @data_sedinta_iso, @ora, @sala, @denumire_dosar, @obiect_cauza, @tip_dosar, @tip_sedinta,
      @rezultat, @pdf_link, datetime('now'))
  `);
  const stmtUpdate = db.prepare('UPDATE sedinte SET ultima_verificare = datetime(\'now\') WHERE id = ?');
  const stmtModificare = db.prepare(`
    INSERT INTO modificari_sedinte (sedinta_id, camp_modificat, valoare_veche, valoare_noua)
    VALUES (?, ?, ?, ?)
  `);
  const stmtUpdateCamp = db.prepare('UPDATE sedinte SET judecator=@judecator, data_sedinta=@data_sedinta, data_sedinta_iso=@data_sedinta_iso, ora=@ora, sala=@sala, rezultat=@rezultat, tip_sedinta=@tip_sedinta, ultima_verificare=datetime(\'now\') WHERE id=@id');
  const stmtLog = db.prepare(`
    INSERT INTO verificari_log (persoana_id, instanta_cod, sedinte_gasite, sedinte_noi, eroare, durata_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const codInstanta of instante) {
    const start = Date.now();
    let sedinteNoi = 0;

    try {
      const sedinte = await scrapeInstanta(codInstanta, persoana.nume, persoana.tip_dosar);
      rezultat.gasite += sedinte.length;

      for (const sedinta of sedinte) {
        const existing = stmtSelect.get(sedinta.hash_unic);

        if (!existing) {
          stmtInsert.run({
            ...sedinta,
            persoana_id: persoana.id
          });
          rezultat.noi++;
          sedinteNoi++;
        } else {
          // Check for modifications
          let modified = false;
          for (const camp of CAMPURI_MONITORIZATE) {
            const veche = existing[camp] || '';
            const noua = sedinta[camp] || '';
            if (veche !== noua) {
              stmtModificare.run(existing.id, camp, veche, noua);
              modified = true;
            }
          }
          if (modified) {
            stmtUpdateCamp.run({
              id: existing.id,
              judecator: sedinta.judecator || '',
              data_sedinta: sedinta.data_sedinta || '',
              data_sedinta_iso: sedinta.data_sedinta_iso || '',
              ora: sedinta.ora || '',
              sala: sedinta.sala || '',
              rezultat: sedinta.rezultat || '',
              tip_sedinta: sedinta.tip_sedinta || ''
            });
            rezultat.modificate++;
          } else {
            stmtUpdate.run(existing.id);
          }
        }
      }

      stmtLog.run(persoana.id, codInstanta, sedinte.length, sedinteNoi, null, Date.now() - start);
    } catch (err) {
      const eroare = err.message || String(err);
      rezultat.erori.push({ instanta: codInstanta, eroare });
      stmtLog.run(persoana.id, codInstanta, 0, 0, eroare, Date.now() - start);
      console.error(`[SCRAPER] Error scraping ${codInstanta} for ${persoana.nume}: ${eroare}`);
    }

    // Delay between requests
    await sleep(SCRAPE_DELAY_MS);
  }

  // Update person's last verification time
  db.prepare('UPDATE persoane_monitorizate SET creat_la = creat_la WHERE id = ?').run(persoana.id);

  return rezultat;
}

export async function scrapeAll() {
  if (isRunning) {
    console.log('[SCRAPER] Already running, skipping');
    return { skipped: true };
  }

  isRunning = true;
  const startTotal = Date.now();

  try {
    const persoane = db.prepare('SELECT * FROM persoane_monitorizate WHERE activ = 1').all();
    const rezultatTotal = { persoane: persoane.length, gasite: 0, noi: 0, modificate: 0, erori: [], sedinte_noi: [], sedinte_modificate: [] };

    for (const persoana of persoane) {
      // Get count of sedinte before scraping
      const countBefore = db.prepare('SELECT COUNT(*) as cnt FROM sedinte WHERE persoana_id = ?').get(persoana.id).cnt;

      const rez = await scrapePersoana(persoana);
      rezultatTotal.gasite += rez.gasite;
      rezultatTotal.noi += rez.noi;
      rezultatTotal.modificate += rez.modificate;
      rezultatTotal.erori.push(...rez.erori);

      // Get newly inserted sedinte for notifications
      if (rez.noi > 0) {
        const noi = db.prepare(`
          SELECT s.*, pm.nume as persoana_nume FROM sedinte s
          JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
          WHERE s.persoana_id = ? ORDER BY s.id DESC LIMIT ?
        `).all(persoana.id, rez.noi);
        rezultatTotal.sedinte_noi.push(...noi);
      }

      // Get recent modifications for notifications
      if (rez.modificate > 0) {
        const mod = db.prepare(`
          SELECT ms.*, s.numar_dosar, s.data_sedinta, s.ora, s.instanta_nume, pm.nume as persoana_nume
          FROM modificari_sedinte ms
          JOIN sedinte s ON s.id = ms.sedinta_id
          JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
          WHERE s.persoana_id = ?
          ORDER BY ms.id DESC LIMIT ?
        `).all(persoana.id, rez.modificate);
        rezultatTotal.sedinte_modificate.push(...mod);
      }
    }

    rezultatTotal.durata_ms = Date.now() - startTotal;
    console.log(`[SCRAPER] Complete: ${rezultatTotal.noi} new, ${rezultatTotal.modificate} modified, ${rezultatTotal.erori.length} errors in ${rezultatTotal.durata_ms}ms`);

    return rezultatTotal;
  } finally {
    isRunning = false;
  }
}

export function isScraperRunning() {
  return isRunning;
}

// --- Court decisions scraping ---

export async function scrapeHotarariInstanta(codInstanta, numePersoana) {
  const types = [
    { path: 'court-decisions', tip: 'Hotărâre' },
    { path: 'court-sentences', tip: 'Încheiere' }
  ];
  const baseUrl = `https://${codInstanta}.instante.justice.md`;
  const allHotarari = [];

  for (const { path, tip } of types) {
    const url = `${baseUrl}/ro/${path}?dossier_part=${encodeURIComponent(numePersoana)}&apply_filter=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8'
        }
      });

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      $('table tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 4) return;

        const numarDosar = $(cells[0]).text().trim();
        const dataPronuntare = $(cells[1]).text().trim();
        const judecator = $(cells[2]).text().trim();
        const solutie = $(cells[3]).text().trim();

        let pdfLink = '';
        const link = $(cells[cells.length - 1]).find('a');
        if (link.length) {
          let href = link.attr('href') || '';
          if (href && !href.startsWith('http')) {
            href = baseUrl + (href.startsWith('/') ? '' : '/') + href;
          }
          pdfLink = href;
        }

        const dataPronuntareIso = parseDataToISO(dataPronuntare);
        const hashStr = `${codInstanta}|${tip}|${numarDosar}|${dataPronuntare}`;
        const hashUnic = createHash('md5').update(hashStr).digest('hex');

        allHotarari.push({
          hash_unic: hashUnic,
          instanta_cod: codInstanta,
          instanta_nume: INSTANTE[codInstanta] || codInstanta,
          numar_dosar: numarDosar,
          tip_act: tip,
          data_pronuntare: dataPronuntare,
          data_pronuntare_iso: dataPronuntareIso,
          judecator,
          solutie,
          pdf_link: pdfLink
        });
      });
    } catch (err) {
      // Silently skip failed requests
      console.error(`[SCRAPER] Error scraping ${path} from ${codInstanta}: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }

    await sleep(SCRAPE_DELAY_MS);
  }

  return allHotarari;
}

export async function scrapeHotarariPersoana(persoana) {
  const instante = JSON.parse(persoana.instante);
  const rezultat = { gasite: 0, noi: 0 };

  const stmtSelect = db.prepare('SELECT * FROM hotarari WHERE hash_unic = ?');
  const stmtInsert = db.prepare(`
    INSERT INTO hotarari (hash_unic, persoana_id, instanta_cod, instanta_nume, numar_dosar, tip_act,
      data_pronuntare, data_pronuntare_iso, judecator, solutie, pdf_link)
    VALUES (@hash_unic, @persoana_id, @instanta_cod, @instanta_nume, @numar_dosar, @tip_act,
      @data_pronuntare, @data_pronuntare_iso, @judecator, @solutie, @pdf_link)
  `);

  for (const codInstanta of instante) {
    try {
      const hotarari = await scrapeHotarariInstanta(codInstanta, persoana.nume);
      rezultat.gasite += hotarari.length;

      for (const h of hotarari) {
        const existing = stmtSelect.get(h.hash_unic);
        if (!existing) {
          stmtInsert.run({ ...h, persoana_id: persoana.id });
          rezultat.noi++;
        }
      }
    } catch (err) {
      console.error(`[SCRAPER] Error scraping hotarari ${codInstanta} for ${persoana.nume}: ${err.message}`);
    }
  }

  return rezultat;
}

export async function scrapeAllHotarari() {
  const persoane = db.prepare('SELECT * FROM persoane_monitorizate WHERE activ = 1').all();
  const rezultatTotal = { persoane: persoane.length, gasite: 0, noi: 0, hotarari_noi: [] };

  for (const persoana of persoane) {
    const rez = await scrapeHotarariPersoana(persoana);
    rezultatTotal.gasite += rez.gasite;
    rezultatTotal.noi += rez.noi;

    if (rez.noi > 0) {
      const noi = db.prepare(`
        SELECT h.*, pm.nume as persoana_nume FROM hotarari h
        JOIN persoane_monitorizate pm ON pm.id = h.persoana_id
        WHERE h.persoana_id = ? ORDER BY h.id DESC LIMIT ?
      `).all(persoana.id, rez.noi);
      rezultatTotal.hotarari_noi.push(...noi);
    }
  }

  return rezultatTotal;
}
