import { Router } from 'express';
import db from '../db/database.js';
import { scrapeAll, scrapeAllHotarari, isScraperRunning, getScrapeProgress } from '../services/scraper.js';
import { sendScrapeReport, sendHotarariReport } from '../services/telegram.js';
import { notifyNewSedinte, notifyModificari, notifyNewHotarari } from '../services/webhook.js';

const router = Router();

router.post('/acum', async (req, res) => {
  if (isScraperRunning()) {
    return res.status(409).json({ error: 'Verificarea este deja în curs' });
  }

  res.json({ message: 'Verificare pornită', status: 'running' });

  // Run scrape in background (don't await in response)
  try {
    const rezultat = await scrapeAll();
    if (rezultat && !rezultat.skipped) {
      await sendScrapeReport(rezultat);
      await notifyNewSedinte(rezultat.sedinte_noi);
      await notifyModificari(rezultat.sedinte_modificate);
    }

    // Also scrape court decisions
    const hotarari = await scrapeAllHotarari();
    if (hotarari.noi > 0) {
      await sendHotarariReport(hotarari);
      await notifyNewHotarari(hotarari.hotarari_noi);
    }
  } catch (err) {
    console.error('[VERIFICARE] Error:', err.message);
  }
});

router.get('/status', (req, res) => {
  res.json(getScrapeProgress());
});

router.get('/log', (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const total = db.prepare('SELECT COUNT(*) as cnt FROM verificari_log').get().cnt;
  const logs = db.prepare(`
    SELECT vl.*, pm.nume as persoana_nume
    FROM verificari_log vl
    LEFT JOIN persoane_monitorizate pm ON pm.id = vl.persoana_id
    ORDER BY vl.timestamp DESC
    LIMIT ? OFFSET ?
  `).all(lim, offset);

  res.json({ data: logs, total, page: parseInt(page, 10), limit: lim, pages: Math.ceil(total / lim) });
});

export default router;
