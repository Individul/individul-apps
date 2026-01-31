"use client"

import { useState } from "react"
import type { ProjectScope } from "@/lib/data/project-details"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Plus, X, Check } from "@phosphor-icons/react/dist/ssr"

type ScopeColumnsProps = {
  scope: ProjectScope
  onSave?: (scope: ProjectScope) => Promise<void>
  editable?: boolean
}

export function ScopeColumns({ scope, onSave, editable = false }: ScopeColumnsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inScope, setInScope] = useState<string[]>(scope.inScope)
  const [outOfScope, setOutOfScope] = useState<string[]>(scope.outOfScope)
  const [newInScope, setNewInScope] = useState("")
  const [newOutOfScope, setNewOutOfScope] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleAddInScope = () => {
    if (newInScope.trim()) {
      setInScope([...inScope, newInScope.trim()])
      setNewInScope("")
    }
  }

  const handleAddOutOfScope = () => {
    if (newOutOfScope.trim()) {
      setOutOfScope([...outOfScope, newOutOfScope.trim()])
      setNewOutOfScope("")
    }
  }

  const handleRemoveInScope = (index: number) => {
    setInScope(inScope.filter((_, i) => i !== index))
  }

  const handleRemoveOutOfScope = (index: number) => {
    setOutOfScope(outOfScope.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true)
      try {
        await onSave({ inScope, outOfScope })
        setIsEditing(false)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleCancel = () => {
    setInScope(scope.inScope)
    setOutOfScope(scope.outOfScope)
    setNewInScope("")
    setNewOutOfScope("")
    setIsEditing(false)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">Scope</h2>
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

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">In scope</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {inScope.length === 0 && !isEditing && (
              <li className="text-muted-foreground/50 italic">No items defined</li>
            )}
            {inScope.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="flex-1">• {item}</span>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemoveInScope(idx)}
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
                placeholder="Add item..."
                value={newInScope}
                onChange={(e) => setNewInScope(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddInScope()}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleAddInScope}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Out of scope</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {outOfScope.length === 0 && !isEditing && (
              <li className="text-muted-foreground/50 italic">No items defined</li>
            )}
            {outOfScope.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="flex-1">• {item}</span>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemoveOutOfScope(idx)}
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
                placeholder="Add item..."
                value={newOutOfScope}
                onChange={(e) => setNewOutOfScope(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddOutOfScope()}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleAddOutOfScope}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
