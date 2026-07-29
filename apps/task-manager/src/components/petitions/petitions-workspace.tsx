"use client";

import { useState } from "react";

import { PetitionAssigneeBreakdown } from "@/components/petitions/petition-assignee-breakdown";
import { PetitionQuickViews } from "@/components/petitions/petition-quick-views";
import { PetitionSummary } from "@/components/petitions/petition-summary";
import { PetitionsList } from "@/components/petitions/petitions-list";
import type { PetitionFilter } from "@/lib/petition-filters";
import type { Petition, Profile } from "@/lib/types";

interface PetitionsWorkspaceProps {
  petitions: Petition[];
  profiles: Profile[];
  currentUserId: string | null;
  isAdmin: boolean;
}

export function PetitionsWorkspace({
  petitions,
  profiles,
  currentUserId,
  isAdmin,
}: PetitionsWorkspaceProps) {
  // Membrul deschide registrul pe petițiile lui — altfel caută printre toate.
  // Adminul îl deschide complet: rolul lui e să vadă ce face echipa.
  const [filter, setFilter] = useState<PetitionFilter>(
    isAdmin || !currentUserId ? {} : { assigneeId: currentUserId },
  );
  // Membrii văd rezumatul propriilor petiții; adminul vede totalul + per utilizator.
  const summaryPetitions = isAdmin
    ? petitions
    : petitions.filter((p) => p.assignee_id === currentUserId);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="lg:w-56 lg:shrink-0">
        <PetitionQuickViews
          petitions={petitions}
          currentUserId={currentUserId}
          filter={filter}
          onFilterChange={setFilter}
        />
      </aside>

      <div className="min-w-0 flex-1">
        <PetitionsList
          petitions={petitions}
          profiles={profiles}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          filter={filter}
          onFilterChange={setFilter}
        />
      </div>

      <aside className="space-y-4 lg:w-80 lg:shrink-0">
        <PetitionSummary
          petitions={summaryPetitions}
          label={isAdmin ? "Rezumat" : "Rezumatul meu"}
        />
        {isAdmin && <PetitionAssigneeBreakdown petitions={petitions} profiles={profiles} />}
      </aside>
    </div>
  );
}
