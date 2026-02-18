import TelegramBot from 'node-telegram-bot-api';
import db from '../db/database.js';
import { scrapeAll, isScraperRunning } from './scraper.js';
import { INSTANTE, TOATE_INSTANTELE } from '../utils/constants.js';

let bot = null;

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[TELEGRAM] No bot token configured, skipping');
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.log('[TELEGRAM] Bot started');

  bot.onText(/\/start/, (msg) => {
    if (chatId && String(msg.chat.id) !== String(chatId)) return;
    bot.sendMessage(msg.chat.id,
      `<b>Monitor Ședințe Judecătorești</b>\n\n` +
      `Comenzi disponibile:\n` +
      `/urmatoarele — Următoarele 5 ședințe\n` +
      `/azi — Ședințele de azi\n` +
      `/maine — Ședințele de mâine\n` +
      `/saptamana — Ședințele din următoarele 7 zile\n` +
      `/cauta {nume} — Caută ședințe pentru un nume\n` +
      `/status — Status sistem\n` +
      `/verifica — Declanșează verificare manuală\n` +
      `/adauga {nume} — Adaugă persoană la monitorizare`,
      { parse_mode: 'HTML' }
    );
  });

  bot.onText(/\/urmatoarele/, (msg) => {
    if (chatId && String(msg.chat.id) !== String(chatId)) return;
    const sedinte = db.prepare(`
      SELECT s.*, pm.nume as persoana_nume FROM sedinte s
      JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
      WHERE s.data_sedinta_iso >= date('now')
      ORDER BY s.data_sedinta_iso ASC, s.ora ASC LIMIT 5
    `).all();

    if (sedinte.length === 0) {
      bot.sendMessage(msg.chat.id, 'Nu sunt ședințe viitoare programate.');
      return;
    }

    let text = `<b>Următoarele ${sedinte.length} ședințe:</b>\n\n`;
    for (const s of sedinte) {
      text += `📅 <b>${s.data_sedinta}</b> ora ${s.ora || '?'}\n`;
      text += `👤 ${s.persoana_nume}\n`;
      text += `🏛️ ${s.instanta_nume}\n`;
      text += `📋 ${s.numar_dosar}\n`;
      if (s.obiect_cauza) text += `⚖️ ${s.obiect_cauza}\n`;
      text += `\n`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  bot.onText(/\/azi/, (msg) => {
    if (chatId && String(msg.chat.id) !== String(chatId)) return;
    const today = new Date().toISOString().split('T')[0];
    const sedinte = db.prepare(`
      SELECT s.*, pm.nume as persoana_nume FROM sedinte s
      JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
      WHERE s.data_sedinta_iso = ?
      ORDER BY s.ora ASC
    `).all(today);

    if (sedinte.length === 0) {
      bot.sendMessage(msg.chat.id, 'Nu sunt ședințe programate pentru azi.');
      return;
    }

    let text = `<b>📅 Ședințe azi (${sedinte.length}):</b>\n\n`;
    for (const s of sedinte) {
      text += `🕐 ${s.ora || '?'} — ${s.persoana_nume}\n`;
      text += `🏛️ ${s.instanta_nume} | 📋 ${s.numar_dosar}\n\n`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  bot.onText(/\/maine/, (msg) => {
    if (chatId && String(msg.chat.id) !== String(chatId)) return;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const sedinte = db.prepare(`
      SELECT s.*, pm.nume as persoana_nume FROM sedinte s
      JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
      WHERE s.data_sedinta_iso = ?
      ORDER BY s.ora ASC
    `).all(tomorrow);

    if (sedinte.length === 0) {
      bot.sendMessage(msg.chat.id, 'Nu sunt ședințe programate pentru mâine.');
      return;
    }

    let text = `<b>📅 Ședințe mâine (${sedinte.length}):</b>\n\n`;
    for (const s of sedinte) {
      text += `🕐 ${s.ora || '?'} — ${s.persoana_nume}\n`;
      text += `🏛️ ${s.instanta_nume} | 📋 ${s.numar_dosar}\n\n`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  bot.onText(/\/saptamana/, (msg) => {
    if (chatId && String(msg.chat.id) !== String(chatId)) return;
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const sedinte = db.prepare(`
      SELECT s.*, pm.nume as persoana_nume FROM sedinte s
      JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
      WHERE s.data_sedinta_iso >= ? AND s.data_sedinta_iso <= ?
      ORDER BY s.data_sedinta_iso ASC, s.ora ASC
    `).all(today, nextWeek);

    if (sedinte.length === 0) {
      bot.sendMessage(msg.chat.id, 'Nu sunt ședințe în următoarele 7 zile.');
      return;
    }

    let text = `<b>📅 Ședințe săptămâna aceasta (${sedinte.length}):</b>\n\n`;
    let currentDate = '';
    for (const s of sedinte) {
      if (s.data_sedinta !== currentDate) {
        currentDate = s.data_sedinta;
        text += `<b>${s.data_sedinta}</b>\n`;
      }
      text += `  🕐 ${s.ora || '?'} — ${s.persoana_nume} — ${s.instanta_nume}\n`;
      text += `  📋 ${s.numar_dosar}\n\n`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  bot.onText(/\/cauta (.+)/, (msg, match) => {
    if (chatId && String(msg.chat.id) !== String(chatId)) return;
    const query = match[1].trim();
    const sedinte = db.prepare(`
      SELECT s.*, pm.nume as persoana_nume FROM sedinte s
      JOIN persoane_monitorizate pm ON pm.id = s.persoana_id
      WHERE s.denumire_dosar LIKE ? OR s.obiect_cauza LIKE ? OR pm.nume LIKE ? OR s.numar_dosar LIKE ?
      ORDER BY s.data_sedinta_iso DESC LIMIT 10
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);

    if (sedinte.length === 0) {
      bot.sendMessage(msg.chat.id, `Nu s-au găsit ședințe pentru "${query}".`);
      return;
    }

    let text = `<b>🔍 Rezultate pentru "${query}" (${sedinte.length}):</b>\n\n`;
    for (const s of sedinte) {
      text += `📅 ${s.data_sedinta} ${s.ora || ''} — ${s.persoana_nume}\n`;
      text += `🏛️ ${s.instanta_nume} | 📋 ${s.numar_dosar}\n`;
      if (s.rezultat) text += `📊 Rezultat: ${s.rezultat}\n`;
      text += `\n`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  bot.onText(/\/status/, (msg) => {
    if (chatId && String(msg.chat.id) !== String(chatId)) return;
    const totalPersoane = db.prepare('SELECT COUNT(*) as cnt FROM persoane_monitorizate WHERE activ = 1').get().cnt;
    const totalSedinte = db.prepare('SELECT COUNT(*) as cnt FROM sedinte').get().cnt;
    const sedinteViitoare = db.prepare("SELECT COUNT(*) as cnt FROM sedinte WHERE data_sedinta_iso >= date('now')").get().cnt;
    const ultimaVerificare = db.prepare('SELECT timestamp FROM verificari_log ORDER BY timestamp DESC LIMIT 1').get();

    bot.sendMessage(msg.chat.id,
      `<b>📊 Status sistem</b>\n\n` +
      `👥 Persoane monitorizate: ${totalPersoane}\n` +
      `📑 Total ședințe: ${totalSedinte}\n` +
      `📅 Ședințe viitoare: ${sedinteViitoare}\n` +
      `🔄 Ultima verificare: ${ultimaVerificare?.timestamp || 'niciodată'}\n` +
      `⚙️ Scraper: ${isScraperRunning() ? 'în curs' : 'inactiv'}`,
      { parse_mode: 'HTML' }
    );
  });

  bot.onText(/\/verifica/, async (msg) => {
    if (chatId && String(msg.chat.id) !== String(chatId)) return;
    if (isScraperRunning()) {
      bot.sendMessage(msg.chat.id, '⏳ Verificarea este deja în curs...');
      return;
    }

    bot.sendMessage(msg.chat.id, '🔄 Pornesc verificarea...');
    try {
      const rezultat = await scrapeAll();
      if (rezultat && !rezultat.skipped) {
        await sendScrapeReport(rezultat);
      }
    } catch (err) {
      bot.sendMessage(msg.chat.id, `❌ Eroare la verificare: ${err.message}`);
    }
  });

  bot.onText(/\/adauga (.+)/, (msg, match) => {
    if (chatId && String(msg.chat.id) !== String(chatId)) return;
    const nume = match[1].trim();
    if (!nume) {
      bot.sendMessage(msg.chat.id, 'Utilizare: /adauga Nume Prenume');
      return;
    }

    const existing = db.prepare('SELECT * FROM persoane_monitorizate WHERE nume = ? AND activ = 1').get(nume);
    if (existing) {
      bot.sendMessage(msg.chat.id, `"${nume}" este deja monitorizat(ă).`);
      return;
    }

    db.prepare('INSERT INTO persoane_monitorizate (nume, instante, tip_dosar) VALUES (?, ?, ?)').run(
      nume,
      JSON.stringify(TOATE_INSTANTELE),
      'Any'
    );
    bot.sendMessage(msg.chat.id,
      `✅ <b>${nume}</b> a fost adăugat(ă) la monitorizare.\n` +
      `Instanțe: toate (${TOATE_INSTANTELE.length})\nTip: Toate`,
      { parse_mode: 'HTML' }
    );
  });
}

export async function sendScrapeReport(rezultat) {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Send individual new hearing notifications
  if (rezultat.sedinte_noi && rezultat.sedinte_noi.length > 0) {
    if (rezultat.sedinte_noi.length <= 3) {
      for (const s of rezultat.sedinte_noi) {
        const text =
          `🔔 <b>Ședință nouă detectată</b>\n\n` +
          `📋 Dosar: ${s.numar_dosar}\n` +
          `👤 Părți: ${(s.denumire_dosar || '').substring(0, 100)}\n` +
          `📅 Data: ${s.data_sedinta} ora ${s.ora || '?'}\n` +
          `🏛️ Instanța: ${s.instanta_nume}\n` +
          `👨‍⚖️ Judecător: ${s.judecator || '—'}\n` +
          `📍 Sala: ${s.sala || '—'}\n` +
          `⚖️ Obiect: ${s.obiect_cauza || '—'}\n` +
          `📁 Tip: ${s.tip_dosar || '—'} | ${s.tip_sedinta || '—'}\n` +
          (s.pdf_link ? `📄 <a href="${s.pdf_link}">Descarcă PDF</a>` : '');

        try {
          await bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
        } catch (err) {
          console.error('[TELEGRAM] Error sending notification:', err.message);
        }
      }
    } else {
      // Summary for many new hearings
      let text = `🔔 <b>${rezultat.sedinte_noi.length} ședințe noi detectate</b>\n\n`;
      for (let i = 0; i < rezultat.sedinte_noi.length; i++) {
        const s = rezultat.sedinte_noi[i];
        text += `${i + 1}. ${s.data_sedinta} ${s.ora || ''} — ${(s.denumire_dosar || '').substring(0, 50)} — ${s.instanta_nume}\n`;
      }
      try {
        await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('[TELEGRAM] Error sending summary:', err.message);
      }
    }
  }

  // Send modification notifications
  if (rezultat.sedinte_modificate && rezultat.sedinte_modificate.length > 0) {
    for (const m of rezultat.sedinte_modificate) {
      const text =
        `⚠️ <b>Modificare detectată</b>\n\n` +
        `📋 Dosar: ${m.numar_dosar}\n` +
        `🔄 ${m.camp_modificat}: ${m.valoare_veche || '—'} → ${m.valoare_noua || '—'}\n` +
        `📅 Ședința din: ${m.data_sedinta} ora ${m.ora || '?'}\n` +
        `🏛️ Instanța: ${m.instanta_nume}`;

      try {
        await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('[TELEGRAM] Error sending modification:', err.message);
      }
    }
  }

  // If nothing new, optionally send a quiet summary (only if explicitly enabled)
  if ((!rezultat.sedinte_noi || rezultat.sedinte_noi.length === 0) &&
      (!rezultat.sedinte_modificate || rezultat.sedinte_modificate.length === 0)) {
    // Don't spam when there's nothing new
    return;
  }
}

export async function sendHotarariReport(rezultat) {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!rezultat.hotarari_noi || rezultat.hotarari_noi.length === 0) return;

  if (rezultat.hotarari_noi.length <= 3) {
    for (const h of rezultat.hotarari_noi) {
      const text =
        `📜 <b>${h.tip_act} nouă detectată</b>\n\n` +
        `📋 Dosar: ${h.numar_dosar}\n` +
        `👤 ${h.persoana_nume}\n` +
        `🏛️ ${h.instanta_nume}\n` +
        `📅 Pronunțare: ${h.data_pronuntare || '?'}\n` +
        `👨‍⚖️ Judecător: ${h.judecator || '—'}\n` +
        `📊 Soluție: ${h.solutie || '—'}\n` +
        (h.pdf_link ? `📄 <a href="${h.pdf_link}">Descarcă PDF</a>` : '');

      try {
        await bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
      } catch (err) {
        console.error('[TELEGRAM] Error sending hotarare notification:', err.message);
      }
    }
  } else {
    let text = `📜 <b>${rezultat.hotarari_noi.length} hotărâri/încheieri noi</b>\n\n`;
    for (let i = 0; i < rezultat.hotarari_noi.length; i++) {
      const h = rezultat.hotarari_noi[i];
      text += `${i + 1}. ${h.tip_act} | ${h.data_pronuntare || '?'} | ${h.instanta_nume} | ${h.numar_dosar}\n`;
    }
    try {
      await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('[TELEGRAM] Error sending hotarari summary:', err.message);
    }
  }
}

export async function sendWeeklyPdfReport() {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) return;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  try {
    const { generateWeeklyReport } = await import('./pdfReport.js');
    const pdfBuffer = await generateWeeklyReport();

    const today = new Date().toISOString().split('T')[0];
    await bot.sendDocument(chatId, pdfBuffer, {
      caption: `📊 Raport săptămânal — ${today}`
    }, {
      filename: `raport-saptamanal-${today}.pdf`,
      contentType: 'application/pdf'
    });

    console.log('[TELEGRAM] Weekly PDF report sent');
  } catch (err) {
    console.error('[TELEGRAM] Error sending weekly report:', err.message);
    try {
      await bot.sendMessage(chatId, `❌ Eroare la generarea raportului săptămânal: ${err.message}`);
    } catch { /* ignore */ }
  }
}

export async function sendTestMessage() {
  if (!bot || !process.env.TELEGRAM_CHAT_ID) {
    throw new Error('Bot sau Chat ID neconfigurat');
  }
  await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, '✅ Mesaj de test — Monitor Ședințe funcționează!');
}

export { bot };
