import db from '../db/database.js';

export async function sendWebhook(event, payload) {
  const webhookUrl = db.prepare("SELECT valoare FROM setari WHERE cheie = 'webhook_url'").get();
  if (!webhookUrl || !webhookUrl.valoare) return;

  const url = webhookUrl.valoare.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
  } catch (err) {
    console.error(`[WEBHOOK] Error sending ${event}:`, err.message);
  }
}

export async function notifyNewSedinte(sedinte) {
  if (!sedinte || sedinte.length === 0) return;
  for (const s of sedinte) {
    await sendWebhook('sedinta_noua', {
      numar_dosar: s.numar_dosar,
      data_sedinta: s.data_sedinta,
      ora: s.ora,
      instanta: s.instanta_nume,
      judecator: s.judecator,
      obiect_cauza: s.obiect_cauza,
      persoana: s.persoana_nume || s.denumire_dosar
    });
  }
}

export async function notifyNewHotarari(hotarari) {
  if (!hotarari || hotarari.length === 0) return;
  for (const h of hotarari) {
    await sendWebhook('hotarare_noua', {
      numar_dosar: h.numar_dosar,
      tip_act: h.tip_act,
      data_pronuntare: h.data_pronuntare,
      instanta: h.instanta_nume,
      judecator: h.judecator,
      solutie: h.solutie,
      persoana: h.persoana_nume
    });
  }
}

export async function notifyModificari(modificari) {
  if (!modificari || modificari.length === 0) return;
  for (const m of modificari) {
    await sendWebhook('sedinta_modificata', {
      numar_dosar: m.numar_dosar,
      data_sedinta: m.data_sedinta,
      instanta: m.instanta_nume,
      camp_modificat: m.camp_modificat,
      valoare_veche: m.valoare_veche,
      valoare_noua: m.valoare_noua
    });
  }
}
