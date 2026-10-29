/**
 * Ce se vede la o adresă care nu există sau la o înregistrare ștearsă
 * (`notFound()`, de pildă la o sarcină deschisă dintr-un link vechi).
 *
 * Fără fișierul ăsta, Next arăta pagina lui: „404 · This page could not be
 * found", în engleză, iar pe un Mac în modul întunecat pe fond negru, sub
 * antetul aplicației, care rămânea alb. Acum arată ca pagina de eroare
 * (`error.tsx`), cu drumul înapoi.
 */

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function PaginaInexistenta() {
  return (
    <main className="mx-auto max-w-6xl p-4 xl:px-10">
      <div className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-6 text-center">
        <p className="text-sm font-medium tabular-nums text-muted-foreground">404</p>
        <h1 className="mt-1 text-lg font-semibold">Pagina nu există</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Adresa e greșită sau înregistrarea a fost ștearsă între timp. Caută omul sau documentul din pagina de
          start.
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <Link href="/">Înapoi la Acasă</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
