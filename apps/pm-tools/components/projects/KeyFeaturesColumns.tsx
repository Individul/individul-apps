"use client"

import { useState } from "react"
import type { KeyFeatures } from "@/lib/data/project-details"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Plus, X, Check } from "@phosphor-icons/react/dist/ssr"

type KeyFeaturesColumnsProps = {
  features: KeyFeatures
  onSave?: (features: KeyFeatures) => Promise<void>
  editable?: boolean
}

export function KeyFeaturesColumns({ features: initialFeatures, onSave, editable = false }: KeyFeaturesColumnsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [p0, setP0] = useState<string[]>(initialFeatures.p0)
  const [p1, setP1] = useState<string[]>(initialFeatures.p1)
  const [p2, setP2] = useState<string[]>(initialFeatures.p2)
  const [newP0, setNewP0] = useState("")
  const [newP1, setNewP1] = useState("")
  const [newP2, setNewP2] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true)
      try {
        await onSave({ p0, p1, p2 })
        setIsEditing(false)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleCancel = () => {
    setP0(initialFeatures.p0)
    setP1(initialFeatures.p1)
    setP2(initialFeatures.p2)
    setNewP0("")
    setNewP1("")
    setNewP2("")
    setIsEditing(false)
  }

  const FeatureList = ({
    items,
    setItems,
    newItem,
    setNewItem,
    label,
  }: {
    items: string[]
    setItems: (items: string[]) => void
    newItem: string
    setNewItem: (value: string) => void
    label: string
  }) => {
    const handleAdd = () => {
      if (newItem.trim()) {
        setItems([...items, newItem.trim()])
        setNewItem("")
      }
    }

    return (
      <div>
        <div className="text-sm font-semibold text-foreground">{label}:</div>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {items.length === 0 && !isEditing && (
            <li className="text-muted-foreground/50 italic">No items</li>
          )}
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="flex-1">• {item}</span>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
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
              placeholder="Add feature..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Key Features</h2>
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

      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <FeatureList items={p0} setItems={setP0} newItem={newP0} setNewItem={setNewP0} label="P0 (Must Have)" />
        <FeatureList items={p1} setItems={setP1} newItem={newP1} setNewItem={setNewP1} label="P1 (Should Have)" />
        <FeatureList items={p2} setItems={setP2} newItem={newP2} setNewItem={setNewP2} label="P2 (Nice to Have)" />
      </div>
    </section>
  )
}
