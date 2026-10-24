"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { runBackupNow } from "@/app/admin/actions";

/**
 * Pornește copia acum, aceeași pe care o face cronul de noapte.
 *
 * Folosită ca să verifici că scrierea în repo merge — după schimbarea
 * jetonului, de pildă — fără să aștepți până a doua zi la 05:00.
 */
export function RunBackup() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await runBackupNow();
      if ("error" in res && !("ok" in res)) {
        toast.error(res.error);
        return;
      }
      if (res.ok) {
        const unde = res.mode === "proba" ? " (probă, sub proba-cloudflare/)" : "";
        toast.success(
          `Copia s-a scris${unde}: ${res.rows} rânduri din ${res.tables} tabele` +
            (res.files_uploaded ? `, ${res.files_uploaded} fișiere noi` : "") +
            (res.files_pending ? `; ${res.files_pending} fișiere așteaptă` : "") +
            ".",
        );
      } else {
        toast.error(res.error ?? "Copia n-a reușit.");
      }
      router.refresh();
    });

  return (
    <Button variant="outline" onClick={run} disabled={isPending}>
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CloudUpload className="mr-2 h-4 w-4" />
      )}
      {isPending ? "Se copiază…" : "Rulează copia acum"}
    </Button>
  );
}
