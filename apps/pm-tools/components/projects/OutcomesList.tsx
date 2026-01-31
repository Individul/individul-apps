"use client"

import { useState } from "react"
import type { ProjectDetails } from "@/lib/data/project-details"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Plus, X, Check } from "@phosphor-icons/react/dist/ssr"

type OutcomesListProps = {
  outcomes: ProjectDetails["outcomes"]
  onSave?: (outcomes: string[]) => Promise<void>
  editable?: boolean
}

export function OutcomesList({ outcomes: initialOutcomes, onSave, editable = false }: OutcomesListProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [outcomes, setOutcomes] = useState<string[]>(initialOutcomes)
  const [newOutcome, setNewOutcome] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleAdd = () => {
    if (newOutcome.trim()) {
      setOutcomes([...outcomes, newOutcome.trim()])
      setNewOutcome("")
    }
  }

  const handleRemove = (index: number) => {
    setOutcomes(outcomes.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true)
      try {
        await onSave(outcomes)
        setIsEditing(false)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleCancel = () => {
    setOutcomes(initialOutcomes)
    setNewOutcome("")
    setIsEditing(false)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Expected Outcomes</h2>
        {editable && !isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
        {isEditing && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Check className="h-4 w-4 mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {outcomes.length === 0 && !isEditing && (
          <li className="text-muted-foreground/50 italic">No outcomes defined</li>
        )}
        {outcomes.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="flex-1">• {item}</span>
            {isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleRemove(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {isEditing && (
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Add outcome..."
            value={newOutcome}
            onChange={(e) => setNewOutcome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </section>
  )
}
