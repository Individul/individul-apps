"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PERIODS, type Period } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { PeriodNav } from "@/components/reports/period-nav";

interface ReportToolbarProps {
  /** Adresa raportului, pe care se pun parametrii. */
  basePath: string;
  /** Unde duce săgeata de întoarcere, și cum se numește locul. */
  inapoiHref: string;
  inapoiEticheta: string;
  period: Period;
  /** Intervalul afișat, scris în litere — ce vede omul între săgeți. */
  eticheta: string;
  /** Ancora perioadei dinainte (AAAA-LL-ZZ). */
  inapoi: string;
  /** Ancora celei următoare, sau `null` când suntem deja în perioada curentă. */
  inainte: string | null;
}

/**
 * Bara de deasupra unui raport pe perioadă. Nu se tipărește — clasa `no-print`.
 *
 * Aceeași piesă la ședințe și la raportul de activitate din administrare: felul
 * perioadei, săgețile și butonul de tipărit se poartă la fel oriunde, iar două
 * copii ale ei s-ar fi despărțit la prima corectură.
 */
export function ReportToolbar({
  basePath,
  inapoiHref,
  inapoiEticheta,
  period,
  eticheta,
  inapoi,
  inainte,
}: ReportToolbarProps) {
  const router = useRouter();
  const params = useSearchParams();

  /*
   * Ancora se păstrează când se schimbă felul perioadei.
   *
   * Dacă te uiți la august și treci pe „Trimestru", ajungi în trimestrul care
   * conține august — nu sari înapoi la cel curent. Altfel fiecare apăsare te-ar
   * întoarce la ziua de azi și n-ai putea privi în urmă decât într-un singur fel.
   */
  const mergiLa = (chei: Record<string, string>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(chei)) q.set(k, v);
    router.push(`${basePath}?${q.toString()}`);
  };

  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-2 border-b pb-4">
      <Link
        href={inapoiHref}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← {inapoiEticheta}
      </Link>

      <div className="ml-4 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => mergiLa({ perioada: p.value })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              p.value === period
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="w-full sm:ml-4 sm:w-auto">
        <PeriodNav
          basePath={basePath}
          eticheta={eticheta}
          inapoi={inapoi}
          inainte={inainte}
        />
      </div>

      <Button type="button" size="sm" className="ml-auto" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" /> Tipărește
      </Button>
    </div>
  );
}
