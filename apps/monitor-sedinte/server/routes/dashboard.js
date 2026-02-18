import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/stats', (req, res) => {
  const totalPersoane = db.prepare('SELECT COUNT(*) as cnt FROM persoane_monitorizate WHERE activ = 1').get().cnt;
  const sedinteViitoare = db.prepare("SELECT COUNT(*) as cnt FROM sedinte WHERE data_sedinta_iso >= date('now')").get().cnt;

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const sedinteAzi = db.prepare('SELECT COUNT(*) as cnt FROM sedinte WHERE data_sedinta_iso = ?').get(today).cnt;
  const sedinteMaine = db.prepare('SELECT COUNT(*) as cnt FROM sedinte WHERE data_sedinta_iso = ?').get(tomorrow).cnt;

  const modificari24h = db.prepare("SELECT COUNT(*) as cnt FROM modificari_sedinte WHERE detectat_la >= datetime('now', '-24 hours')").get().cnt;
  const sedinteNoi24h = db.prepare("SELECT COUNT(*) as cnt FROM sedinte WHERE prima_detectare >= datetime('now', '-24 hours')").get().cnt;

  const ultimaVerificare = db.prepare('SELECT timestamp FROM verificari_log ORDER BY timestamp DESC LIMIT 1').get();

  res.json({
    total_persoane: totalPersoane,
    sedinte_viitoare: sedinteViitoare,
    sedinte_azi: sedinteAzi,
    sedinte_maine: sedinteMaine,
    modificari_24h: modificari24h,
    sedinte_noi_24h: sedinteNoi24h,
    ultima_verificare: ultimaVerificare?.timestamp || null
  });
});

router.get('/timeline', (req, res) => {
  const timeline = db.prepare(`
    SELECT date(prima_detectare) as zi, COUNT(*) as count
    FROM sedinte
    WHERE prima_detectare >= datetime('now', '-30 days')
    GROUP BY date(prima_detectare)
    ORDER BY zi ASC
  `).all();

  res.json(timeline);
});

router.get('/activitate', (req, res) => {
  const activitate = db.prepare(`
    SELECT vl.*, pm.nume as persoana_nume
    FROM verificari_log vl
    LEFT JOIN persoane_monitorizate pm ON pm.id = vl.persoana_id
    ORDER BY vl.timestamp DESC
    LIMIT 20
  `).all();

  res.json(activitate);
});

router.get('/urmatoarele', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const sedinte = db.prepare(`
    SELECT s.*, pm.nume as persoana_nume
    FROM sedinte s
    JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
    WHERE s.data_sedinta_iso >= date('now')
    ORDER BY s.data_sedinta_iso ASC, s.ora ASC
    LIMIT ?
  `).all(limit);

  res.json(sedinte);
});

// Badge data for sidebar (7-day hearing count + last verification status)
router.get('/badge', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const sedinte7zile = db.prepare(
    'SELECT COUNT(*) as cnt FROM sedinte WHERE data_sedinta_iso >= ? AND data_sedinta_iso <= ?'
  ).get(today, nextWeek).cnt;

  const ultimaVerificare = db.prepare(
    'SELECT timestamp, eroare FROM verificari_log ORDER BY timestamp DESC LIMIT 1'
  ).get();

  res.json({
    sedinte_7_zile: sedinte7zile,
    ultima_verificare_ok: ultimaVerificare ? !ultimaVerificare.eroare : null,
    ultima_verificare: ultimaVerificare?.timestamp || null
  });
});

export default router;
