"use client";

/**
 * Plasa de sub antet pentru erorile care scapă din pagină.
 *
 * Erorile de pe server se întorc deja ca mesaje (`lib/sigur.ts`). Aici ajung
 * cele din browser: o acțiune chemată din `startTransition` când rețeaua a
 * căzut sau când fila a rămas pe o versiune mai veche a aplicației. Fără
 * fișierul ăsta, Next înlocuia toată fereastra cu „Application error", fără
 * antet și fără vreun buton. Acum antetul rămâne, iar omul are două ieșiri:
 * reîncercarea pe loc sau reîncărcarea paginii, care rezolvă și versiunea veche.
 */

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Eroare({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Rămâne în consola browserului, pentru o eventuală depanare.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-6xl p-4 xl:px-10">
      <div className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Ceva n-a mers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pagina n-a putut termina ce făcea. Încearcă din nou. Dacă nu merge, reîncarcă pagina: se poate
          ca aplicația să fi fost actualizată între timp.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => reset()}>
            Încearcă din nou
          </Button>
          <Button onClick={() => window.location.reload()}>Reîncarcă pagina</Button>
        </div>
      </div>
    </main>
  );
}
