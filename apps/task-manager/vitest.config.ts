import { defineConfig } from "vitest/config";

/**
 * Testele rulează pe UTC, ca serverul.
 *
 * Nu e o preferință, ci condiția ca testele de fus orar să însemne ceva:
 * mașinile de aici stau pe Europe/Bucharest, care are exact același decalaj ca
 * Europe/Chisinau, tot anul. Pe un ceas local o citire greșită a zilei — cea
 * de pe ceasul serverului în loc de cea de la Chișinău — dă același rezultat
 * ca cea corectă, deci `todayInChisinau` ar putea fi stricată fără ca vreun
 * test să se supere. Pe Vercel, unde ceasul e UTC, aceeași greșeală mută ziua.
 *
 * Se scrie în `process.env` înainte de pornirea proceselor de test, ca ele să
 * moștenească fusul de la naștere: pe Windows, Node a ignorat multă vreme
 * variabila `TZ` schimbată din mers, iar proiectul ăsta s-a ars deja o dată de
 * la asta. `src/lib/periods.test.ts` verifică explicit că fusul a prins,
 * tocmai ca o regresie de-a lui Node să nu treacă neobservată.
 */
process.env.TZ = "UTC";

// Vitest rulează testele din src/. Cele de date merg pe un D1 adevărat
// (`src/lib/db/test-db.ts`), deci acoperă și ce acoperea odinioară un test E2E.
export default defineConfig({
  // Ca în tsconfig: modulele de date și cele de logare se importă între ele
  // cu `@/`, iar testele lor le încarcă așa cum le încarcă și aplicația.
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
