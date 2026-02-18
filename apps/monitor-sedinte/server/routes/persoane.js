import { Router } from 'express';
import db from '../db/database.js';
import { INSTANTE, TOATE_INSTANTELE } from '../utils/constants.js';
import { scrapePersoana } from '../services/scraper.js';

const router = Router();

router.get('/', (req, res) => {
  const { activ } = req.query;
  let query = 'SELECT * FROM persoane_monitorizate';
  const params = [];
  if (activ !== undefined) {
    query += ' WHERE activ = ?';
    params.push(parseInt(activ, 10));
  }
  query += ' ORDER BY creat_la DESC';

  const persoane = db.prepare(query).all(...params);

  // Enrich with upcoming hearings count
  const stmtCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM sedinte
    WHERE persoana_id = ? AND data_sedinta_iso >= date('now')
  `);
  const stmtLastCheck = db.prepare(`
    SELECT timestamp FROM verificari_log
    WHERE persoana_id = ? ORDER BY timestamp DESC LIMIT 1
  `);

  const enriched = persoane.map(p => ({
    ...p,
    instante: JSON.parse(p.instante),
    sedinte_viitoare: stmtCount.get(p.id).cnt,
    ultima_verificare: stmtLastCheck.get(p.id)?.timestamp || null
  }));

  res.json(enriched);
});

router.post('/', (req, res) => {
  const { nume, instante, tip_dosar, nota } = req.body;
  if (!nume || !nume.trim()) {
    return res.status(400).json({ error: 'Numele este obligatoriu' });
  }

  const instanteList = instante && instante.length > 0 ? instante : TOATE_INSTANTELE;
  const stmt = db.prepare(`
    INSERT INTO persoane_monitorizate (nume, instante, tip_dosar, nota)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(nume.trim(), JSON.stringify(instanteList), tip_dosar || 'Any', nota || null);

  const persoana = db.prepare('SELECT * FROM persoane_monitorizate WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...persoana, instante: JSON.parse(persoana.instante) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nume, instante, tip_dosar, nota, activ } = req.body;

  const existing = db.prepare('SELECT * FROM persoane_monitorizate WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Persoana nu a fost găsită' });
  }

  const stmt = db.prepare(`
    UPDATE persoane_monitorizate
    SET nume = ?, instante = ?, tip_dosar = ?, nota = ?, activ = ?
    WHERE id = ?
  `);
  stmt.run(
    nume || existing.nume,
    instante ? JSON.stringify(instante) : existing.instante,
    tip_dosar || existing.tip_dosar,
    nota !== undefined ? nota : existing.nota,
    activ !== undefined ? activ : existing.activ,
    id
  );

  const updated = db.prepare('SELECT * FROM persoane_monitorizate WHERE id = ?').get(id);
  res.json({ ...updated, instante: JSON.parse(updated.instante) });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM persoane_monitorizate WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Persoana nu a fost găsită' });
  }

  db.prepare('UPDATE persoane_monitorizate SET activ = 0 WHERE id = ?').run(id);
  res.json({ ok: true, message: 'Persoana a fost dezactivată' });
});

router.post('/:id/verificare', async (req, res) => {
  const { id } = req.params;
  const persoana = db.prepare('SELECT * FROM persoane_monitorizate WHERE id = ?').get(id);
  if (!persoana) {
    return res.status(404).json({ error: 'Persoana nu a fost găsită' });
  }

  try {
    const rezultat = await scrapePersoana(persoana);
    res.json(rezultat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
