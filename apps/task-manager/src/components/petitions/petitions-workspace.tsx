"use client";

import { useState } from "react";

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
  const [filter, setFilter] = useState<PetitionFilter>({});

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="lg:w-56 lg:shrink-0">{/* Vederi rapide */}</aside>

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

      <aside className="space-y-4 lg:w-80 lg:shrink-0">{/* Rezumat + pe responsabil */}</aside>
    </div>
  );
}
