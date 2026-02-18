import PDFDocument from 'pdfkit';
import db from '../db/database.js';

export function generateWeeklyReport() {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const today = new Date();
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - 7);
      const nextWeekEnd = new Date(today);
      nextWeekEnd.setDate(today.getDate() + 7);

      const lastWeekISO = lastWeekStart.toISOString().split('T')[0];
      const todayISO = today.toISOString().split('T')[0];
      const nextWeekISO = nextWeekEnd.toISOString().split('T')[0];

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Raport Saptamanal — Monitor Sedinte', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor('#666')
        .text(`Generat: ${today.toLocaleDateString('ro-RO')} ${today.toLocaleTimeString('ro-RO')}`, { align: 'center' });
      doc.moveDown(1);

      // Stats
      const totalPersoane = db.prepare('SELECT COUNT(*) as cnt FROM persoane_monitorizate WHERE activ = 1').get().cnt;
      const sedinteNoi7zile = db.prepare('SELECT COUNT(*) as cnt FROM sedinte WHERE prima_detectare >= ?').get(lastWeekISO).cnt;
      const sedinteViitoare = db.prepare("SELECT COUNT(*) as cnt FROM sedinte WHERE data_sedinta_iso >= ?").get(todayISO).cnt;
      const hotarariNoi7zile = db.prepare('SELECT COUNT(*) as cnt FROM hotarari WHERE prima_detectare >= ?').get(lastWeekISO).cnt;
      const verificari7zile = db.prepare('SELECT COUNT(*) as cnt FROM verificari_log WHERE timestamp >= ?').get(lastWeekISO).cnt;

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Statistici');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor('#333');

      const stats = [
        ['Persoane monitorizate:', String(totalPersoane)],
        ['Sedinte noi (7 zile):', String(sedinteNoi7zile)],
        ['Sedinte viitoare:', String(sedinteViitoare)],
        ['Hotarari noi (7 zile):', String(hotarariNoi7zile)],
        ['Verificari efectuate (7 zile):', String(verificari7zile)]
      ];

      for (const [label, value] of stats) {
        doc.text(`  ${label} ${value}`);
      }
      doc.moveDown(1);

      // Last week's new hearings
      const sedinteLastWeek = db.prepare(`
        SELECT s.*, pm.nume as persoana_nume FROM sedinte s
        JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
        WHERE s.prima_detectare >= ?
        ORDER BY s.data_sedinta_iso ASC
        LIMIT 50
      `).all(lastWeekISO);

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000')
        .text(`Sedinte noi detectate (${sedinteLastWeek.length})`);
      doc.moveDown(0.3);

      if (sedinteLastWeek.length === 0) {
        doc.fontSize(10).font('Helvetica').fillColor('#666').text('  Nicio sedinta noua.');
      } else {
        doc.fontSize(9).font('Helvetica').fillColor('#333');
        for (const s of sedinteLastWeek) {
          const line = `${s.data_sedinta} ${s.ora || ''} | ${s.instanta_nume} | ${s.numar_dosar} | ${s.persoana_nume}`;
          doc.text(`  ${line}`, { width: 510 });
          if (s.obiect_cauza) {
            doc.fillColor('#666').text(`    Obiect: ${s.obiect_cauza}`, { width: 500 });
            doc.fillColor('#333');
          }
          doc.moveDown(0.2);
        }
      }
      doc.moveDown(0.8);

      // Upcoming hearings
      const sedinteUrmatoare = db.prepare(`
        SELECT s.*, pm.nume as persoana_nume FROM sedinte s
        JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
        WHERE s.data_sedinta_iso >= ? AND s.data_sedinta_iso <= ?
        ORDER BY s.data_sedinta_iso ASC, s.ora ASC
        LIMIT 50
      `).all(todayISO, nextWeekISO);

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000')
        .text(`Sedinte urmatoarele 7 zile (${sedinteUrmatoare.length})`);
      doc.moveDown(0.3);

      if (sedinteUrmatoare.length === 0) {
        doc.fontSize(10).font('Helvetica').fillColor('#666').text('  Nicio sedinta programata.');
      } else {
        doc.fontSize(9).font('Helvetica').fillColor('#333');
        let currentDate = '';
        for (const s of sedinteUrmatoare) {
          if (s.data_sedinta !== currentDate) {
            currentDate = s.data_sedinta;
            doc.moveDown(0.2);
            doc.font('Helvetica-Bold').text(`  ${s.data_sedinta}`);
            doc.font('Helvetica');
          }
          doc.text(`    ${s.ora || '?'} — ${s.persoana_nume} — ${s.instanta_nume} — ${s.numar_dosar}`, { width: 500 });
        }
      }
      doc.moveDown(0.8);

      // New court decisions
      const hotarariLastWeek = db.prepare(`
        SELECT h.*, pm.nume as persoana_nume FROM hotarari h
        JOIN persoane_monitorizate pm ON pm.id = h.persoana_id
        WHERE h.prima_detectare >= ?
        ORDER BY h.data_pronuntare_iso DESC
        LIMIT 30
      `).all(lastWeekISO);

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000')
        .text(`Hotarari/Incheieri noi (${hotarariLastWeek.length})`);
      doc.moveDown(0.3);

      if (hotarariLastWeek.length === 0) {
        doc.fontSize(10).font('Helvetica').fillColor('#666').text('  Nicio hotarare noua.');
      } else {
        doc.fontSize(9).font('Helvetica').fillColor('#333');
        for (const h of hotarariLastWeek) {
          doc.text(`  ${h.data_pronuntare || '?'} | ${h.tip_act} | ${h.instanta_nume} | ${h.numar_dosar}`, { width: 510 });
          if (h.solutie) {
            doc.fillColor('#666').text(`    Solutie: ${h.solutie}`, { width: 500 });
            doc.fillColor('#333');
          }
          doc.moveDown(0.2);
        }
      }

      // Footer
      doc.moveDown(1);
      doc.fontSize(8).font('Helvetica').fillColor('#999')
        .text('Generat automat de Monitor Sedinte v1.0', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
