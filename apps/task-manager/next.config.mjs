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
   * Antetele de securitate, pe fiecare răspuns al aplicației.
   *
   * Pe Vercel, HSTS-ul îl punea platforma; Cloudflare nu pune nimic din toate
   * acestea, deci le cerem aici.
   * - HSTS: browserul nu mai încearcă niciodată HTTP pe adresa asta, nici la
   *   prima tastare. Valoarea e cea trimisă de Vercel.
   * - Încadrarea interzisă (`X-Frame-Options` pentru browserele vechi,
   *   `frame-ancestors` pentru cele noi): alt site nu poate pune aplicația
   *   într-un cadru invizibil peste butoanele lui. Aplicația nu se încadrează
   *   nici singură: fișierele se deschid în filă nouă.
   * - `nosniff`: browserul ține de tipul declarat al unui fișier și nu ghicește
   *   altul, deci un atașament nu poate fi luat drept script.
   * - `same-origin`: adresele interne (căi, parametri) nu pleacă spre alte
   *   site-uri când se urmează o legătură.
   * Fără o politică CSP întreagă: scripturile inline ale Next ar cere nonce-uri
   * pe fiecare pagină, iar o greșeală acolo ar opri aplicația, nu un atacator.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
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
