/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite backup-uri mai mari la restaurare (upload prin server action).
    serverActions: {
      bodySizeLimit: "10mb",
    },

    /**
     * Cât ține browserul minte o pagină deja vizitată, ca să n-o mai ceară.
     *
     * Valorile de aici sunt EXACT cele implicite din Next 14.2 — citite din
     * `node_modules/next/dist/server/config-shared.js`, nu presupuse. Deci
     * astăzi nu schimbă nimic; e o ancoră.
     *
     * În Next 15 implicitul pentru rutele dinamice coboară la 0, adică fiecare
     * întoarcere la un modul deja deschis ar cere din nou serverului. Toate
     * paginile de aici sunt dinamice, deci ziua trecerii la 15 ar face
     * navigarea vizibil mai greoaie — fără ca nimic din codul nostru să se fi
     * schimbat și fără vreo eroare care să arate de ce.
     *
     * 30 de secunde e o fereastră scurtă: ce vezi la a doua intrare într-un
     * registru poate fi cu o jumătate de minut mai vechi. Pentru cifre care se
     * schimbă de câteva ori pe zi e o târguială bună, iar orice salvare proprie
     * cheamă `router.refresh()`, care golește memoria.
     */
    staleTimes: {
      dynamic: 30,
      static: 300,
    },

    /**
     * Fonturile pentru PDF, cărate explicit în funcția care le citește.
     *
     * `/raport-saptamanal/pdf` deschide `src/fonts/*.ttf` cu `fs` la fiecare
     * cerere, iar în funcția serverless ajung doar fișierele pe care Next le
     * *urmărește*. Fișierele citite la rulare nu se văd în niciun import, deci
     * regula generală e că nu ajung — local merge oricum, fiindcă acolo repo-ul
     * întreg e pe disc, exact felul de defect care trece de tot ce poți încerca
     * de pe calculatorul tău și cade la prima descărcare din producție.
     *
     * Măsurat, nu presupus: ștergând intrarea asta și reconstruind, fonturile
     * *tot* apar în trace — analizorul lui Next reușește azi să evalueze
     * `path.join(process.cwd(), "src", "fonts")` și numele scrise alături. Deci
     * intrarea nu repară nimic acum; e o ancoră. Norocul ăla ține de o
     * euristică pe cod: o refactorizare care compune numele fișierului dintr-o
     * variabilă îl orbește, iar pierderea n-ar da nicio eroare la build —
     * doar butonul „Descarcă PDF" ar începe să întoarcă 500 în producție.
     *
     * Calea e relativă la rădăcina proiectului, iar fișierele își păstrează
     * poziția în funcție — de aceea ruta le caută tot sub `process.cwd()`.
     *
     * Verificabil înainte de deploy: după `npm run build`, ambele `.ttf` trebuie
     * să fie în `.next/server/app/raport-saptamanal/pdf/route.js.nft.json`,
     * lista după care Vercel împachetează funcția.
     */
    outputFileTracingIncludes: {
      "/raport-saptamanal/pdf": ["./src/fonts/*.ttf"],
    },
  },
};
export default nextConfig;
