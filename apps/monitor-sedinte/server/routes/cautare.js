import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ persoane: [], sedinte: [] });
  }

  const query = `%${q.trim()}%`;

  const persoane = db.prepare(`
    SELECT * FROM persoane_monitorizate
    WHERE nume LIKE ? AND activ = 1
    LIMIT 5
  `).all(query);

  const sedinte = db.prepare(`
    SELECT s.*, pm.nume as persoana_nume
    FROM sedinte s
    JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
    WHERE s.denumire_dosar LIKE ? OR s.obiect_cauza LIKE ? OR s.judecator LIKE ? OR s.numar_dosar LIKE ?
    ORDER BY s.data_sedinta_iso DESC
    LIMIT 10
  `).all(query, query, query, query);

  res.json({ persoane, sedinte });
});

export default router;
