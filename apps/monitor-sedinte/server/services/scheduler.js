import cron from 'node-cron';
import { scrapeAll, scrapeAllHotarari } from './scraper.js';
import { sendScrapeReport, sendHotarariReport, sendWeeklyPdfReport } from './telegram.js';
import { notifyNewSedinte, notifyModificari, notifyNewHotarari } from './webhook.js';

export function startScheduler() {
  const morning = process.env.CRON_SCHEDULE_MORNING || '0 7 * * *';
  const evening = process.env.CRON_SCHEDULE_EVENING || '0 19 * * *';

  cron.schedule(morning, async () => {
    console.log('[CRON] Starting morning scrape at', new Date().toISOString());
    try {
      const results = await scrapeAll();
      if (results && !results.skipped) {
        await sendScrapeReport(results);
        await notifyNewSedinte(results.sedinte_noi);
        await notifyModificari(results.sedinte_modificate);
      }

      const hotarari = await scrapeAllHotarari();
      if (hotarari.noi > 0) {
        await sendHotarariReport(hotarari);
        await notifyNewHotarari(hotarari.hotarari_noi);
      }
    } catch (err) {
      console.error('[CRON] Morning scrape error:', err.message);
    }
  }, { timezone: 'Europe/Chisinau' });

  cron.schedule(evening, async () => {
    console.log('[CRON] Starting evening scrape at', new Date().toISOString());
    try {
      const results = await scrapeAll();
      if (results && !results.skipped) {
        await sendScrapeReport(results);
        await notifyNewSedinte(results.sedinte_noi);
        await notifyModificari(results.sedinte_modificate);
      }

      const hotarari = await scrapeAllHotarari();
      if (hotarari.noi > 0) {
        await sendHotarariReport(hotarari);
        await notifyNewHotarari(hotarari.hotarari_noi);
      }
    } catch (err) {
      console.error('[CRON] Evening scrape error:', err.message);
    }
  }, { timezone: 'Europe/Chisinau' });

  // Weekly PDF report: Monday at 08:00
  cron.schedule('0 8 * * 1', async () => {
    console.log('[CRON] Generating weekly PDF report at', new Date().toISOString());
    try {
      await sendWeeklyPdfReport();
    } catch (err) {
      console.error('[CRON] Weekly report error:', err.message);
    }
  }, { timezone: 'Europe/Chisinau' });

  console.log(`[CRON] Scheduled: morning=${morning}, evening=${evening}, weekly=Monday 08:00 (Europe/Chisinau)`);
}
