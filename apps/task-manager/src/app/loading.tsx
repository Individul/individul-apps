/**
 * Ce se vede între clic și sosirea paginii.
 *
 * Până acum nu se vedea nimic: paginile se randează pe server, iar fără fișierul
 * acesta browserul rămâne pe pagina veche, neclintit, până răspunde serverul.
 * Din afară asta nu se deosebește de o aplicație care s-a blocat — și de acolo
 * venea impresia că e mai înceată decât hub-ul vechi, care fiind o aplicație de
 * browser schimba ecranul pe loc.
 *
 * Stă lângă layout-ul rădăcină, deci înlocuiește numai ce e sub antet. Bara și
 * tab-urile rămân pe ecran, iar tab-ul apăsat se aprinde imediat: clicul are un
 * răspuns înainte ca serverul să fi apucat să răspundă.
 *
 * Un al doilea câștig, mai puțin la vedere: Next descarcă din vreme starea de
 * încărcare a rutelor din legături, deci schimbarea se desenează fără nicio
 * așteptare de rețea.
 *
 * Formele sunt anume nedeslușite — un titlu, câteva dreptunghiuri. Un schelet
 * care ar imita prea bine pagina adevărată se citește ca date care încă nu
 * există.
 *
 * DE ȘTIUT, fiindcă a costat deja o defecțiune în producție: fișierul acesta e
 * o graniță `Suspense` peste tot conținutul paginii, iar `router.refresh()`
 * cade în ea și DEMONTEAZĂ subarborele — se pierde toată starea de client de
 * sub el, inclusiv ferestrele deschise. Documentația lui Next spune că
 * `refresh()` păstrează starea; cu `loading.tsx` prezent, nu o păstrează.
 *
 * Măsurat pe o reproducere minimală, cu aceeași versiune de Next:
 *
 *   acțiune de server, apoi setState, FĂRĂ refresh ....... starea rămâne
 *   aceleași, cu `router.refresh()` .................... starea se pierde
 *   aceleași, fără `loading.tsx` ....................... starea rămâne
 *   `router.refresh()` înfășurat în `startTransition` .. starea se pierde
 *
 * Scheletul nu apare la reîmprospătare — nu clipește nimic — dar subarborele
 * se reface oricum. Deci: NU chema `router.refresh()` cât timp o fereastră
 * trebuie să rămână deschisă. Amână-l până la închidere, ca în
 * `petition-form-dialog.tsx`, unde înregistrarea unei petiții ține fereastra
 * deschisă pentru atașarea scanării.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl p-4 xl:px-10" aria-busy="true" aria-live="polite">
      {/* Pentru cititoarele de ecran, un cuvânt; restul e doar desen. */}
      <span className="sr-only">Se încarcă…</span>
      <div aria-hidden className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded-md bg-muted" />
        <div className="h-10 w-full rounded-md bg-muted" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-40 rounded-lg bg-muted" />
          <div className="h-40 rounded-lg bg-muted" />
        </div>
        <div className="h-28 rounded-lg bg-muted" />
      </div>
    </main>
  );
}
