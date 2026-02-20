"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet"
import { TrackerIssueCreate, TRACKER_CATEGORIES, TRACKER_PRIORITIES, trackerApi } from "@/lib/api"
import { Loader2 } from "lucide-react"

interface IssueFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function IssueForm({ open, onOpenChange, onSuccess }: IssueFormProps) {
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<string>("")

  const isBug = category === "BUG_CRITIC" || category === "BUG_MINOR"

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const token = localStorage.getItem("access_token")
    if (!token) return

    const formData = new FormData(e.currentTarget)
    const data: TrackerIssueCreate = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      priority: formData.get("priority") as string,
      module_name: formData.get("module_name") as string,
      steps_to_reproduce: formData.get("steps_to_reproduce") as string,
      expected_behavior: formData.get("expected_behavior") as string,
      actual_behavior: formData.get("actual_behavior") as string,
    }

    try {
      await trackerApi.create(token, data)
      onSuccess()
      onOpenChange(false)
      setCategory("")
    } catch (error) {
      console.error("Failed to create issue:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setCategory("") }}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Problemă nouă</SheetTitle>
          <SheetDescription>
            Raportează un bug sau propune o îmbunătățire pentru SIA.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="title">Titlu *</Label>
            <Input
              id="title"
              name="title"
              placeholder="Descrie pe scurt problema"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categorie *</Label>
              <Select name="category" required value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează" />
                </SelectTrigger>
                <SelectContent>
                  {TRACKER_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioritate</Label>
              <Select name="priority" defaultValue="MEDIU">
                <SelectTrigger>
                  <SelectValue placeholder="Selectează" />
                </SelectTrigger>
                <SelectContent>
                  {TRACKER_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="module_name">Modul afectat</Label>
            <Input
              id="module_name"
              name="module_name"
              placeholder="ex: Termene, Petiții, Dashboard"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descriere</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Descrie problema în detaliu"
              rows={3}
            />
          </div>

          {isBug && (
            <>
              <div className="space-y-2">
                <Label htmlFor="steps_to_reproduce">Pași de reproducere</Label>
                <Textarea
                  id="steps_to_reproduce"
                  name="steps_to_reproduce"
                  placeholder="1. Deschide pagina...&#10;2. Apasă pe...&#10;3. Observă că..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_behavior">Comportament așteptat</Label>
                <Textarea
                  id="expected_behavior"
                  name="expected_behavior"
                  placeholder="Ce ar fi trebuit să se întâmple"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="actual_behavior">Comportament actual</Label>
                <Textarea
                  id="actual_behavior"
                  name="actual_behavior"
                  placeholder="Ce se întâmplă de fapt"
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Hidden fields for non-bug categories */}
          {!isBug && (
            <>
              <input type="hidden" name="steps_to_reproduce" value="" />
              <input type="hidden" name="expected_behavior" value="" />
              <input type="hidden" name="actual_behavior" value="" />
            </>
          )}

          <SheetFooter className="pt-4">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Creează
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
