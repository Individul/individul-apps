import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { RELEASE_GROUNDS } from "./releases";
import type { NotificationType } from "./types";

/*
 * Temeiurile sunt scrise în două locuri — harta din `releases.ts` și
 * `check (ground in …)` din migrarea 0029 — fiindcă unul e TypeScript și
 * celălalt SQL, iar niciunul nu poate fi generat din celălalt la rulare.
 *
 * Două copii înseamnă că se pot despărți, iar despărțirea nu doare nicăieri
 * unde s-ar vedea: nu la compilare, nu la testele obișnuite, nu la build.
 * Iese abia în ziua în care cineva alege din meniu temeiul adăugat pe jumătate
 * și baza refuză salvarea — la ghișeu, cu un rând deja scris pe hârtie.
 *
 * Testele de aici citesc chiar fișierul migrării, ca despărțirea să cadă în
 * locul în care se repară ieftin.
 */

const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations",
);

/**
 * Valorile dintr-un `check (<coloană> in ('a', 'b', …))`.
 *
 * `[^)]*` se oprește la prima paranteză închisă, ceea ce e exact lista căutată:
 * niciunul dintre cele două `check`-uri din 0029 n-are paranteze între apostrofi.
 * Coloana intră în șablon, deci `ground` și `type` nu se pot încurca între ele,
 * chiar dacă stau în același fișier.
 */
function checkValues(sql: string, column: string): string[] {
  const toate = [
    ...sql.matchAll(new RegExp(`check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)`, "gi")),
  ];
  // Ultima definiție câștigă, ca în baza de date: o constrângere rescrisă mai
  // târziu în același fișier o înlocuiește pe cea dinainte, nu se adaugă la ea.
  const ultima = toate.at(-1);
  if (!ultima) return [];
  return [...ultima[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/**
 * Toate migrările, în ordine, lipite una de alta.
 *
 * Nu doar 0029. O migrare viitoare care rescrie lista de temeiuri sau pe cea de
 * tipuri ar lăsa un test fixat pe 0029 verde peste o bază care s-a mișcat — și
 * atunci garda nu doar că n-ar mai păzi nimic, ci ar și liniști pe cine o
 * caută. Fișierele se citesc sortate, iar `checkValues` ia ultima potrivire,
 * deci rezultatul e ce spune baza după ultima migrare aplicată.
 */
const SQL = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
  .join("\n");

describe("temeiurile din TypeScript și cele din bază", () => {
  const dinSql = checkValues(SQL, "ground");
  const dinCod = Object.keys(RELEASE_GROUNDS);

  it("parserul chiar a citit migrarea", () => {
    // Testul de mai jos ar cădea și fără garda asta — dar ar cădea spunând că
    // nouăsprezece temeiuri lipsesc din bază, adică o minciună care trimite
    // omul în migrare, unde totul e în regulă. Aici se vede dintr-o privire că
    // s-a stricat cititul fișierului, nu lista.
    expect(dinSql.length, "nu s-a citit nicio migrare").toBeGreaterThan(0);
  });

  it("sunt aceleași, în ambele sensuri", () => {
    // Ambele sensuri, fiindcă fiecare lipsă strică altceva. Un temei care e
    // doar în bază nu poate fi ales de nimeni: capacitate moartă, plus rânduri
    // pe care pagina nu știe să le eticheteze dacă ajung acolo pe altă cale. Un
    // temei care e doar în cod se alege din meniu și se lovește de constrângere
    // la salvare.
    //
    // Sortate: ordinea din hartă e a meniului și se poate schimba oricând
    // pentru cine îl citește, fără să aibă vreo treabă cu ordinea din SQL.
    expect([...dinSql].sort()).toEqual([...dinCod].sort());
  });
});

describe("tipurile de notificare", () => {
  it('„eliberare" e permis și în bază', () => {
    // Anunțul de dimineață se scrie din `notify_todays_releases()`, deci un
    // `type` respins de constrângere n-ar da nicio eroare pe ecran: funcția
    // crapă în pg_cron, la ora șase, unde nu se uită nimeni, iar modulul pare
    // doar că nu are eliberări azi.
    const permise = checkValues(SQL, "type");
    expect(permise).toContain("eliberare");
  });

  it("uniunea din TypeScript nu a rămas în urmă", () => {
    // Obiectul nu e o listă de întreținut cu mâna, ci felul în care întrebăm
    // compilatorul: `Record<NotificationType, true>` nu se compilează dacă
    // uniunii i s-a adăugat un tip care nu apare aici. Fișierele de test intră
    // în `tsconfig`, deci `npm run build` chiar cade.
    const PREZENT: Record<NotificationType, true> = {
      assigned: true,
      comment: true,
      status: true,
      edited: true,
      deleted: true,
      created: true,
      eliberare: true,
    };
    // Bucla verifică celălalt sens: un tip permis de bază, dar necunoscut
    // uniunii, ar ajunge în pagină ca notificare fără iconiță și fără text.
    // Dacă parserul ar întoarce o listă goală, bucla ar trece fără să verifice
    // nimic — de asta stă imediat sub testul de mai sus, singurul care o poate
    // prinde goală.
    const permise = checkValues(SQL, "type");
    for (const t of permise) expect(Object.keys(PREZENT)).toContain(t);
  });
});
