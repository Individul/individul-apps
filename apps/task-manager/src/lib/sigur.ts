/**
 * Plasa acțiunilor de server pentru erorile neprevăzute.
 *
 * Stratul de date întoarce singur `{ error }` pentru tot ce poate greși omul
 * (drept, date invalide, rând dispărut). Rămân erorile din afara lui: D1 sau R2
 * indisponibile o clipă, o limită a platformei. O asemenea eroare, aruncată
 * dintr-o acțiune, ajunge în browser ca excepție. Interfața cheamă acțiunile din
 * `startTransition`, iar React o duce până la granița de eroare, adică pagina
 * întreagă se înlocuiește cu ecranul de eroare, pentru o salvare ratată.
 *
 * Aici eroarea se scrie în jurnalul Worker-ului (Observability), iar omul
 * primește un mesaj obișnuit, ca la orice altă salvare refuzată.
 */

import { unstable_rethrow } from "next/navigation";

export const EROARE_NEPREVAZUTA =
  "Operația n-a reușit din cauza unei erori pe server. Încearcă din nou peste câteva clipe.";

/** Eșecul neprevăzut; `success` e scris ca absent, ca `res.success` să se poată citi. */
export type Esec = { error: string; success?: undefined };

export async function sigur<T>(fn: () => Promise<T>): Promise<T | Esec> {
  try {
    return await fn();
  } catch (e) {
    // `redirect()`, `notFound()` și semnalele interne ale Next sunt tot
    // excepții, dar nu sunt erori: trebuie să treacă mai departe neatinse.
    unstable_rethrow(e);
    console.error(
      JSON.stringify({
        actiune_esuata: e instanceof Error ? e.message : String(e),
        stiva: e instanceof Error ? e.stack : undefined,
      }),
    );
    return { error: EROARE_NEPREVAZUTA };
  }
}
