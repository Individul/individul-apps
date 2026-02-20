"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IssueStatusBadge, IssuePriorityBadge, IssueCategoryBadge } from "@/components/tracker/issue-badges"
import {
  TrackerIssueDetail,
  trackerApi,
  TRACKER_CATEGORIES,
  TRACKER_PRIORITIES,
  TRACKER_STATUSES,
} from "@/lib/api"
import { formatDateTime } from "@/lib/utils"
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Save,
  Clock,
  User,
  Layers,
} from "lucide-react"

interface IssueDetailPageProps {
  params: { id: string }
}

export default function IssueDetailPage({ params }: IssueDetailPageProps) {
  const router = useRouter()
  const [issue, setIssue] = useState<TrackerIssueDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState("")
  const [status, setStatus] = useState("")
  const [moduleName, setModuleName] = useState("")
  const [stepsToReproduce, setStepsToReproduce] = useState("")
  const [expectedBehavior, setExpectedBehavior] = useState("")
  const [actualBehavior, setActualBehavior] = useState("")
  const [resolutionNotes, setResolutionNotes] = useState("")

  const isBug = category === "BUG_CRITIC" || category === "BUG_MINOR"

  useEffect(() => {
    loadIssue()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  async function loadIssue() {
    setLoading(true)
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return
      const data = await trackerApi.get(token, params.id)
      setIssue(data)
      setTitle(data.title)
      setDescription(data.description || "")
      setCategory(data.category)
      setPriority(data.priority)
      setStatus(data.status)
      setModuleName(data.module_name || "")
      setStepsToReproduce(data.steps_to_reproduce || "")
      setExpectedBehavior(data.expected_behavior || "")
      setActualBehavior(data.actual_behavior || "")
      setResolutionNotes(data.resolution_notes || "")
    } catch (error) {
      console.error("Failed to load issue:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!issue) return
    setSaving(true)
    try {
      const token = localStorage.getItem("access_token")
      if (!token) return
      await trackerApi.update(token, issue.id, {
        title,
        description,
        category,
        priority,
        status,
        module_name: moduleName,
        steps_to_reproduce: stepsToReproduce,
        expected_behavior: expectedBehavior,
        actual_behavior: actualBehavior,
        resolution_notes: resolutionNotes,
      })
      await loadIssue()
    } catch (error) {
      console.error("Failed to save issue:", error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!issue || !confirm("Ești sigur că vrei să ștergi această problemă?")) return
    const token = localStorage.getItem("access_token")
    if (!token) return
    setDeleting(true)
    try {
      await trackerApi.delete(token, issue.id)
      router.push("/tracker")
    } catch (error) {
      console.error("Failed to delete issue:", error)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!issue) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Problema nu a fost găsită</p>
        <Link href="/tracker">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la listă
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/tracker">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Înapoi
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <IssueStatusBadge status={issue.status} />
            <IssuePriorityBadge priority={issue.priority} />
            <IssueCategoryBadge category={issue.category} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvează
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left - Form */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Titlu</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titlul problemei"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Categorie</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKER_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioritate</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKER_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKER_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="module_name">Modul afectat</Label>
              <Input
                id="module_name"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                placeholder="ex: Termene, Petiții, Dashboard"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descriere</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrie problema în detaliu"
                rows={4}
              />
            </div>

            {isBug && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="steps_to_reproduce">Pași de reproducere</Label>
                  <Textarea
                    id="steps_to_reproduce"
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    placeholder="1. Deschide pagina...&#10;2. Apasă pe...&#10;3. Observă că..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_behavior">Comportament așteptat</Label>
                  <Textarea
                    id="expected_behavior"
                    value={expectedBehavior}
                    onChange={(e) => setExpectedBehavior(e.target.value)}
                    placeholder="Ce ar fi trebuit să se întâmple"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actual_behavior">Comportament actual</Label>
                  <Textarea
                    id="actual_behavior"
                    value={actualBehavior}
                    onChange={(e) => setActualBehavior(e.target.value)}
                    placeholder="Ce se întâmplă de fapt"
                    rows={3}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="resolution_notes">Note rezolvare</Label>
              <Textarea
                id="resolution_notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Cum a fost rezolvată problema"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Right - Metadata */}
        <div className="w-80 border-l bg-muted/30 p-6">
          <h2 className="font-semibold mb-4">Informații</h2>
          <div className="space-y-4 text-sm">
            {issue.created_by_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <div>
                  <p className="text-xs text-muted-foreground">Creat de</p>
                  <p className="text-foreground">{issue.created_by_name}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <div>
                <p className="text-xs text-muted-foreground">Data creării</p>
                <p className="text-foreground">{formatDateTime(issue.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <div>
                <p className="text-xs text-muted-foreground">Ultima actualizare</p>
                <p className="text-foreground">{formatDateTime(issue.updated_at)}</p>
              </div>
            </div>
            {issue.module_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Layers className="h-4 w-4" />
                <div>
                  <p className="text-xs text-muted-foreground">Modul</p>
                  <p className="text-foreground">{issue.module_name}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
