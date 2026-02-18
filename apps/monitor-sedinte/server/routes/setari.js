import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM setari').all();
  const setari = {};
  for (const row of rows) {
    setari[row.cheie] = row.valoare;
  }

  // Add env-based defaults for display
  setari.cron_morning = setari.cron_morning || process.env.CRON_SCHEDULE_MORNING || '0 7 * * *';
  setari.cron_evening = setari.cron_evening || process.env.CRON_SCHEDULE_EVENING || '0 19 * * *';
  setari.telegram_configured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  setari.scrape_delay_ms = process.env.SCRAPE_DELAY_MS || '2000';

  res.json(setari);
});

router.put('/', (req, res) => {
  const { setari } = req.body;
  if (!setari || typeof setari !== 'object') {
    return res.status(400).json({ error: 'Format invalid' });
  }

  const stmt = db.prepare('INSERT OR REPLACE INTO setari (cheie, valoare) VALUES (?, ?)');
  const transaction = db.transaction((entries) => {
    for (const [cheie, valoare] of entries) {
      stmt.run(cheie, String(valoare));
    }
  });

  transaction(Object.entries(setari));
  res.json({ ok: true });
});

router.get('/status', (req, res) => {
  const totalPersoane = db.prepare('SELECT COUNT(*) as cnt FROM persoane_monitorizate WHERE activ = 1').get().cnt;
  const totalSedinte = db.prepare('SELECT COUNT(*) as cnt FROM sedinte').get().cnt;
  const sedinteViitoare = db.prepare("SELECT COUNT(*) as cnt FROM sedinte WHERE data_sedinta_iso >= date('now')").get().cnt;
  const ultimaVerificare = db.prepare('SELECT timestamp, eroare FROM verificari_log ORDER BY timestamp DESC LIMIT 1').get();
  const verificari24h = db.prepare("SELECT COUNT(*) as cnt FROM verificari_log WHERE timestamp >= datetime('now', '-24 hours')").get().cnt;

  res.json({
    uptime: process.uptime(),
    node_version: process.version,
    total_persoane: totalPersoane,
    total_sedinte: totalSedinte,
    sedinte_viitoare: sedinteViitoare,
    ultima_verificare: ultimaVerificare?.timestamp || null,
    ultima_eroare: ultimaVerificare?.eroare || null,
    verificari_24h: verificari24h,
    telegram_configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  });
});

export default router;
