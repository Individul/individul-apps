import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { persoana, instanta, tip, pagina = 1, limit = 20, sort = 'data_pronuntare_iso', dir = 'DESC' } = req.query;
  const allowedSorts = ['data_pronuntare_iso', 'numar_dosar', 'instanta_nume', 'tip_act'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'data_pronuntare_iso';
  const sortDir = dir === 'ASC' ? 'ASC' : 'DESC';
  const offset = (parseInt(pagina, 10) - 1) * parseInt(limit, 10);

  let where = 'WHERE 1=1';
  const params = [];

  if (persoana) {
    where += ' AND h.persoana_id = ?';
    params.push(persoana);
  }
  if (instanta) {
    where += ' AND h.instanta_cod = ?';
    params.push(instanta);
  }
  if (tip) {
    where += ' AND h.tip_act = ?';
    params.push(tip);
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM hotarari h ${where}`).get(...params).cnt;
  const data = db.prepare(`
    SELECT h.*, pm.nume as persoana_nume
    FROM hotarari h
    JOIN persoane_monitorizate pm ON pm.id = h.persoana_id
    ${where}
    ORDER BY h.${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), offset);

  res.json({ data, total, pagina: parseInt(pagina, 10), limit: parseInt(limit, 10) });
});

export default router;
