"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TransferDialog } from "@/components/transfers/transfer-dialog";
import { TransferRegister } from "@/components/transfers/transfer-register";
import { TransferSummary } from "@/components/transfers/transfer-summary";
import {
  PERIODS,
  parseISODate,
  rangeForPeriod,
  toISODate,
  type Period,
} from "@/lib/periods";
import { cn } from "@/lib/utils";
import type { Transfer } from "@/lib/types";

interface TransfersWorkspaceProps {
  /** Registrul întreg, în ordinea interogării: ziua descrescător, instituția crescător. */
  transfers: Transfer[];
  /** Ziua curentă (AAAA-LL-ZZ), calculată pe server. */
  today: string;
  /** Doar curtoazie în interfață — gardul de la ștergere e RLS. */
  isAdmin: boolean;
}

export function TransfersWorkspace({ transfers, today, isAdmin }: TransfersWorkspaceProps) {
  const [period, setPeriod] = useState<Period>("luna");
  const [open, setOpen] = useState(false);
  // Rândul deschis spre editare; gol înseamnă adăugare.
  const [editing, setEditing] = useState<Transfer | null>(null);

  const reference = parseISODate(today);
  const range = rangeForPeriod(period, reference);
  // Datele sunt AAAA-LL-ZZ, deci comparația de text e și comparație de calendar.
  const from = toISODate(range.from);
  const to = toISODate(range.to);
  const rows = transfers.filter((t) => t.transfer_date >= from && t.transfer_date <= to);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
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
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Adaugă transfer
        </Button>
      </div>

      <TransferSummary rows={rows} range={range} today={reference} />

      <TransferRegister
        rows={rows}
        onEdit={(t) => {
          setEditing(t);
          setOpen(true);
        }}
      />

      <TransferDialog
        open={open}
        onOpenChange={setOpen}
        transfer={editing}
        today={today}
        isAdmin={isAdmin}
      />
    </div>
  );
}
