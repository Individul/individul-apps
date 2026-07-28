"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PetitionFiltersBar } from "@/components/petitions/petition-filters-bar";
import { PetitionFormDialog } from "./petition-form-dialog";
import { STATUS_LABEL, STATUS_DOT, PETITIONER_LABEL, daysUntil } from "./meta";
import { avatarColor } from "@/lib/avatar-color";
import { filterPetitions, type PetitionFilter } from "@/lib/petition-filters";
import { cn } from "@/lib/utils";
import type { Petition, Profile } from "@/lib/types";

function initials(name: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface PetitionsListProps {
  petitions: Petition[];
  profiles: Profile[];
  currentUserId: string | null;
  isAdmin: boolean;
  filter: PetitionFilter;
  onFilterChange: (f: PetitionFilter) => void;
}

export function PetitionsList({
  petitions,
  profiles,
  currentUserId,
  isAdmin,
  filter,
  onFilterChange,
}: PetitionsListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Petition | undefined>(undefined);

  const rows = useMemo(() => {
    const filtered = filterPetitions(petitions, filter);
    // Nesoluționate primele, apoi după termen (cele mai apropiate sus).
    return [...filtered].sort((a, b) => {
      const solvedA = a.status === "solutionat" ? 1 : 0;
      const solvedB = b.status === "solutionat" ? 1 : 0;
      if (solvedA !== solvedB) return solvedA - solvedB;
      return (a.response_deadline ?? "9999-12-31").localeCompare(
        b.response_deadline ?? "9999-12-31",
      );
    });
  }, [petitions, filter]);

  const filtersActive = Boolean(
    filter.search || filter.status || filter.assigneeId || filter.due,
  );

  const openEdit = (p: Petition) => {
    setEditing(p);
    setFormOpen(true);
  };

  return (
    <div>
      <PetitionFiltersBar
        profiles={profiles}
        currentUserId={currentUserId}
        filter={filter}
        onFilterChange={onFilterChange}
        onNewPetition={() => {
          setEditing(undefined);
          setFormOpen(true);
        }}
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        {/* Antet */}
        <div className="flex items-center gap-3 border-b bg-muted/30 px-3.5 py-2 text-[11px] font-medium text-muted-foreground">
          <span className="w-28 shrink-0">Nr.</span>
          <span className="w-48 shrink-0">Petiționar</span>
          <span className="min-w-0 flex-1">Obiect</span>
          <span className="w-40 shrink-0">Responsabil</span>
          <span className="w-28 shrink-0">Termen</span>
          <span className="w-32 shrink-0">Stare</span>
        </div>

        {rows.length ? (
          <div className="divide-y">
            {rows.map((p) => {
              const d = daysUntil(p.response_deadline);
              const solved = p.status === "solutionat";
              const overdue = !solved && d !== null && d < 0;
              const soon = !solved && d !== null && d >= 0 && d <= 5;
              return (
                <div
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className="flex cursor-pointer items-center gap-3 px-3.5 py-2 transition-colors hover:bg-muted/50"
                >
                  {/* Nr. */}
                  <span className="w-28 shrink-0 truncate text-sm font-medium">{p.number}</span>

                  {/* Petiționar */}
                  <div className="w-48 min-w-0 shrink-0">
                    <div className="truncate text-[13px]">{p.petitioner}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {PETITIONER_LABEL[p.petitioner_type]}
                    </div>
                  </div>

                  {/* Obiect */}
                  <div className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                    {p.subject || "—"}
                  </div>

                  {/* Responsabil */}
                  <div className="flex w-40 min-w-0 shrink-0 items-center gap-2">
                    {p.assignee ? (
                      <>
                        <Avatar className="h-6 w-6">
                          <AvatarFallback
                            className={cn("text-[10px]", avatarColor(p.assignee.id))}
                          >
                            {initials(p.assignee.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-[13px]">
                          {p.assignee.full_name ?? "—"}
                        </span>
                      </>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">Neatribuit</span>
                    )}
                  </div>

                  {/* Termen */}
                  <div className="w-28 shrink-0 text-[13px]">
                    {p.response_deadline ? (
                      <span
                        className={cn(
                          overdue && "font-medium text-red-600",
                          soon && "text-amber-600",
                        )}
                      >
                        {format(parseISO(p.response_deadline), "d MMM yyyy")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Stare */}
                  <div className="flex w-32 shrink-0 items-center gap-2">
                    <span
                      className={cn("h-2 w-2 rounded-full", STATUS_DOT[p.status])}
                      aria-hidden
                    />
                    <span className="text-[13px] text-muted-foreground">
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-muted-foreground">
            {filtersActive ? "Nicio petiție găsită." : "Nicio petiție înregistrată."}
          </div>
        )}
      </div>

      <PetitionFormDialog
        profiles={profiles}
        petition={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </div>
  );
}
