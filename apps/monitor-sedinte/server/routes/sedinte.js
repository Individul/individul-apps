import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

router.get('/', (req, res) => {
  const { persoana_id, instanta, tip_dosar, viitoare, cautare, page = 1, limit = 20, sort = 'data_sedinta_iso', order = 'DESC' } = req.query;

  let where = [];
  let params = [];

  if (persoana_id) {
    where.push('s.persoana_id = ?');
    params.push(parseInt(persoana_id, 10));
  }
  if (instanta) {
    where.push('s.instanta_cod = ?');
    params.push(instanta);
  }
  if (tip_dosar && tip_dosar !== 'Any') {
    where.push('s.tip_dosar = ?');
    params.push(tip_dosar);
  }
  if (viitoare === '1' || viitoare === 'true') {
    where.push("s.data_sedinta_iso >= date('now')");
  }
  if (cautare) {
    where.push("(s.denumire_dosar LIKE ? OR s.obiect_cauza LIKE ? OR s.judecator LIKE ? OR s.numar_dosar LIKE ?)");
    const q = `%${cautare}%`;
    params.push(q, q, q, q);
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  // Validate sort column
  const validSorts = ['data_sedinta_iso', 'ora', 'instanta_cod', 'numar_dosar', 'judecator', 'tip_dosar', 'prima_detectare'];
  const sortCol = validSorts.includes(sort) ? sort : 'data_sedinta_iso';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const countQuery = `SELECT COUNT(*) as total FROM sedinte s ${whereClause}`;
  const total = db.prepare(countQuery).get(...params).total;

  const dataQuery = `
    SELECT s.*, pm.nume as persoana_nume
    FROM sedinte s
    JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
    ${whereClause}
    ORDER BY s.${sortCol} ${sortOrder}
    LIMIT ? OFFSET ?
  `;
  const sedinte = db.prepare(dataQuery).all(...params, lim, offset);

  // Check for recent modifications on each sedinta
  const stmtMod = db.prepare(`
    SELECT camp_modificat, valoare_veche, valoare_noua, detectat_la
    FROM modificari_sedinte
    WHERE sedinta_id = ? AND detectat_la >= datetime('now', '-24 hours')
    ORDER BY detectat_la DESC
  `);

  const enriched = sedinte.map(s => ({
    ...s,
    modificari_recente: stmtMod.all(s.id)
  }));

  res.json({
    data: enriched,
    total,
    page: parseInt(page, 10),
    limit: lim,
    pages: Math.ceil(total / lim)
  });
});

router.get('/viitoare', (req, res) => {
  const sedinte = db.prepare(`
    SELECT s.*, pm.nume as persoana_nume
    FROM sedinte s
    JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
    WHERE s.data_sedinta_iso >= date('now')
    ORDER BY s.data_sedinta_iso ASC, s.ora ASC
  `).all();

  res.json(sedinte);
});

router.get('/calendar', (req, res) => {
  const { luna, an } = req.query;
  const now = new Date();
  const month = parseInt(luna, 10) || (now.getMonth() + 1);
  const year = parseInt(an, 10) || now.getFullYear();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const sedinte = db.prepare(`
    SELECT s.*, pm.nume as persoana_nume
    FROM sedinte s
    JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
    WHERE s.data_sedinta_iso >= ? AND s.data_sedinta_iso < ?
    ORDER BY s.data_sedinta_iso ASC, s.ora ASC
  `).all(startDate, endDate);

  // Group by date
  const grouped = {};
  for (const s of sedinte) {
    if (!grouped[s.data_sedinta_iso]) {
      grouped[s.data_sedinta_iso] = [];
    }
    grouped[s.data_sedinta_iso].push(s);
  }

  res.json(grouped);
});

router.get('/export', (req, res) => {
  const { persoana_id, instanta, tip_dosar, viitoare, cautare } = req.query;

  let where = [];
  let params = [];

  if (persoana_id) {
    where.push('s.persoana_id = ?');
    params.push(parseInt(persoana_id, 10));
  }
  if (instanta) {
    where.push('s.instanta_cod = ?');
    params.push(instanta);
  }
  if (tip_dosar && tip_dosar !== 'Any') {
    where.push('s.tip_dosar = ?');
    params.push(tip_dosar);
  }
  if (viitoare === '1' || viitoare === 'true') {
    where.push("s.data_sedinta_iso >= date('now')");
  }
  if (cautare) {
    where.push("(s.denumire_dosar LIKE ? OR s.obiect_cauza LIKE ? OR s.judecator LIKE ? OR s.numar_dosar LIKE ?)");
    const q = `%${cautare}%`;
    params.push(q, q, q, q);
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const sedinte = db.prepare(`
    SELECT s.*, pm.nume as persoana_nume
    FROM sedinte s
    JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
    ${whereClause}
    ORDER BY s.data_sedinta_iso DESC, s.ora DESC
  `).all(...params);

  // BOM for UTF-8 Excel compatibility
  const BOM = '\uFEFF';
  const headers = ['Data', 'Ora', 'Instanța', 'Nr. Dosar', 'Denumire', 'Judecător', 'Obiect', 'Tip dosar', 'Tip ședință', 'Rezultat', 'Persoana'];
  const rows = sedinte.map(s => [
    s.data_sedinta, s.ora, s.instanta_nume, s.numar_dosar,
    s.denumire_dosar, s.judecator, s.obiect_cauza,
    s.tip_dosar, s.tip_sedinta, s.rezultat, s.persoana_nume
  ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','));

  const csv = BOM + headers.join(',') + '\n' + rows.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sedinte.csv"');
  res.send(csv);
});

router.get('/:id', (req, res) => {
  const sedinta = db.prepare(`
    SELECT s.*, pm.nume as persoana_nume
    FROM sedinte s
    JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!sedinta) {
    return res.status(404).json({ error: 'Ședința nu a fost găsită' });
  }

  const modificari = db.prepare(`
    SELECT * FROM modificari_sedinte
    WHERE sedinta_id = ?
    ORDER BY detectat_la DESC
  `).all(req.params.id);

  res.json({ ...sedinta, modificari });
});

export default router;
