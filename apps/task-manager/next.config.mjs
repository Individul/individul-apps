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
     * `node_modules/next/dist/server/config-shared.js`, nu presupuse.
     *
     * În Next 15 implicitul pentru rutele dinamice a coborât la 0, adică fiecare
     * întoarcere la un modul deja deschis ar cere din nou serverului. Toate
     * paginile de aici sunt dinamice, deci fără intrarea asta trecerea la 15 ar
     * fi făcut navigarea vizibil mai greoaie — fără ca nimic din codul nostru să
     * se fi schimbat și fără vreo eroare care să arate de ce. Ea păstrează
     * comportamentul din 14.
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
  },

  /**
   * Fonturile PDF-ului intră în cod, ca text base64.
   *
   * Pe Workers nu există disc: `/raport-saptamanal/pdf` nu mai are de unde
   * citi `src/fonts/*.ttf` la cerere, cum făcea pe Vercel. Importate, fonturile
   * ajung în pachetul Worker-ului și merg la fel sub `next dev`, fără o a doua
   * cale de citire doar pentru local. Costul: circa 1,1 MB în pachet, din cei
   * 10 MB permiși.
   */
  webpack(config) {
    // `asset` cu inline mereu, nu `asset/inline`: Next dă tuturor modulelor
    // „asset" un `filename`, iar `asset/inline` refuză opțiunea și pică build-ul.
    config.module.rules.push({
      test: /\.ttf$/,
      type: "asset",
      parser: { dataUrlCondition: () => true },
    });
    return config;
  },
};

// Sub `next dev`, `getCloudflareContext()` primește legăturile din
// wrangler.toml (D1, R2) simulate local, ca în Worker.
if (process.env.NODE_ENV === "development") {
  const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

export default nextConfig;
