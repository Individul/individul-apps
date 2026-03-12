'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  IndicatieDetail,
  IndicatieDestinatar,
  IndicatieComentariu,
  IndicatieFisier,
  TaskUser,
  indicatiiApi,
  tasksApi,
} from '@/lib/api'
import { useUserRole } from '@/lib/use-user-role'
import { formatDate, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Save,
  Send,
  Upload,
  Download,
  FileText,
  MessageSquare,
  Paperclip,
  User,
  Check,
  X,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8004'

function getCurrentUserId(): number | null {
  try {
    const token = localStorage.getItem('access_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.user_id ?? null
  } catch {
    return null
  }
}

function PrioritateBadge({ prioritate }: { prioritate: string }) {
  switch (prioritate) {
    case 'URGENT':
      return <Badge className="bg-red-100 text-red-700 border-transparent">Urgent</Badge>
    case 'NORMAL':
      return <Badge className="bg-blue-100 text-blue-700 border-transparent">Normal</Badge>
    case 'SCAZUT':
      return <Badge className="bg-gray-100 text-gray-600 border-transparent">Scazut</Badge>
    default:
      return <Badge variant="secondary">{prioritate}</Badge>
  }
}

function StatusIndicatieBadge({ status }: { status: string }) {
  switch (status) {
    case 'NOU':
      return <Badge className="bg-amber-100 text-amber-700 border-transparent">Nou</Badge>
    case 'IN_LUCRU':
      return <Badge className="bg-blue-100 text-blue-700 border-transparent">In lucru</Badge>
    case 'INDEPLINIT':
      return <Badge className="bg-green-100 text-green-700 border-transparent">Indeplinit</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getOverallStatus(indicatie: IndicatieDetail): string {
  const dest = indicatie.destinatari
  if (!dest || dest.length === 0) return 'NOU'
  if (dest.every(d => d.status === 'INDEPLINIT')) return 'INDEPLINIT'
  if (dest.some(d => d.status === 'IN_LUCRU' || d.status === 'INDEPLINIT')) return 'IN_LUCRU'
  return 'NOU'
}

interface IndicatieDetailPageProps {
  params: { id: string }
}

export default function IndicatieDetailPage({ params }: IndicatieDetailPageProps) {
  const router = useRouter()
  const { isViewer } = useUserRole()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [indicatie, setIndicatie] = useState<IndicatieDetail | null>(null)
  const [users, setUsers] = useState<TaskUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [activeTab, setActiveTab] = useState<'comentarii' | 'fisiere'>('comentarii')

  // Form state
  const [titlu, setTitlu] = useState('')
  const [descriere, setDescriere] = useState('')
  const [isEditingDescriere, setIsEditingDescriere] = useState(false)
  const [prioritate, setPrioritate] = useState<string>('NORMAL')
  const [termenLimita, setTermenLimita] = useState('')
  const [selectedDestinatari, setSelectedDestinatari] = useState<number[]>([])
  const [persoanaLegata, setPersoanaLegata] = useState('')

  const currentUserId = useMemo(() => getCurrentUserId(), [])

  const myDestinatar = useMemo(() => {
    if (!indicatie || !currentUserId) return null
    return indicatie.destinatari.find(d => d.destinatar === currentUserId) || null
  }, [indicatie, currentUserId])

  const isCreator = useMemo(() => {
    if (!indicatie || !currentUserId) return false
    return indicatie.created_by === currentUserId
  }, [indicatie, currentUserId])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    loadIndicatie()
    tasksApi.users(token).then(setUsers).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  async function loadIndicatie() {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) return
      const data = await indicatiiApi.get(token, params.id)
      setIndicatie(data)
      setTitlu(data.titlu)
      setDescriere(data.descriere || '')
      setPrioritate(data.prioritate)
      setTermenLimita(data.termen_limita || '')
      setSelectedDestinatari(data.destinatari.map(d => d.destinatar))
      setPersoanaLegata(data.persoana_legata_name || '')
    } catch (error) {
      console.error('Failed to load indicatie:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!indicatie) return
    setSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) return
      await indicatiiApi.update(token, indicatie.id, {
        titlu: titlu.trim(),
        descriere: descriere.trim(),
        prioritate,
        termen_limita: termenLimita || null,
        destinatari_ids: selectedDestinatari,
        persoana_legata_name: persoanaLegata.trim() || null,
      })
      await loadIndicatie()
    } catch (error) {
      console.error('Failed to save indicatie:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!indicatie || !confirm('Esti sigur ca vrei sa stergi aceasta indicatie?')) return
    const token = localStorage.getItem('access_token')
    if (!token) return
    setDeleting(true)
    try {
      await indicatiiApi.delete(token, indicatie.id)
      router.push('/indicatii')
    } catch (error) {
      console.error('Failed to delete indicatie:', error)
      setDeleting(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!indicatie) return
    const token = localStorage.getItem('access_token')
    if (!token) return
    setUpdatingStatus(true)
    try {
      await indicatiiApi.updateStatus(token, indicatie.id, newStatus)
      await loadIndicatie()
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleAddComment() {
    if (!indicatie || !comment.trim()) return
    const token = localStorage.getItem('access_token')
    if (!token) return
    setSendingComment(true)
    try {
      await indicatiiApi.addComment(token, indicatie.id, comment.trim())
      setComment('')
      await loadIndicatie()
    } catch (error) {
      console.error('Failed to add comment:', error)
    } finally {
      setSendingComment(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !indicatie) return
    const token = localStorage.getItem('access_token')
    if (!token) return
    setUploading(true)
    try {
      await indicatiiApi.uploadFile(token, indicatie.id, file)
      await loadIndicatie()
    } catch (error) {
      console.error('Failed to upload file:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteFile(fisierId: string) {
    if (!indicatie || !confirm('Stergi acest fisier?')) return
    const token = localStorage.getItem('access_token')
    if (!token) return
    try {
      await indicatiiApi.deleteFile(token, indicatie.id, fisierId)
      await loadIndicatie()
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  function toggleDestinatar(userId: number) {
    setSelectedDestinatari(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  function renderTextWithLinks(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline break-all">
            {part}
          </a>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  function getNextStatuses(currentStatus: string): { value: string; label: string }[] {
    switch (currentStatus) {
      case 'NOU':
        return [{ value: 'IN_LUCRU', label: 'Incepe lucrul' }]
      case 'IN_LUCRU':
        return [{ value: 'INDEPLINIT', label: 'Marcheaza indeplinit' }]
      case 'INDEPLINIT':
        return [{ value: 'IN_LUCRU', label: 'Redeschide' }]
      default:
        return []
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!indicatie) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Indicatia nu a fost gasita</p>
        <Link href="/indicatii">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Inapoi la lista
          </Button>
        </Link>
      </div>
    )
  }

  const overallStatus = getOverallStatus(indicatie)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/indicatii">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Inapoi
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <StatusIndicatieBadge status={overallStatus} />
            <PrioritateBadge prioritate={indicatie.prioritate} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isCreator || !isViewer) && (
            <>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isViewer || deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
              <Button onClick={handleSave} disabled={isViewer || saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salveaza
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left - Form */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-2">
              <Label htmlFor="titlu">Titlu</Label>
              <Input
                id="titlu"
                value={titlu}
                onChange={(e) => setTitlu(e.target.value)}
                placeholder="Titlul indicatiei"
                disabled={isViewer}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descriere">Descriere</Label>
              {isEditingDescriere && !isViewer ? (
                <Textarea
                  id="descriere"
                  value={descriere}
                  onChange={(e) => {
                    setDescriere(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onBlur={() => setIsEditingDescriere(false)}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto'
                      el.style.height = el.scrollHeight + 'px'
                      el.focus()
                    }
                  }}
                  placeholder="Descrierea indicatiei"
                  className="min-h-[100px] resize-none overflow-hidden"
                  disabled={isViewer}
                />
              ) : (
                <div
                  onClick={() => !isViewer && setIsEditingDescriere(true)}
                  className={`min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words ${isViewer ? 'cursor-default opacity-50' : 'cursor-text'}`}
                >
                  {descriere ? renderTextWithLinks(descriere) : <span className="text-muted-foreground">Descrierea indicatiei</span>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioritate</Label>
                <Select value={prioritate} onValueChange={setPrioritate} disabled={isViewer}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="SCAZUT">Scazut</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="termen">Termen limita</Label>
                <Input
                  id="termen"
                  type="date"
                  value={termenLimita}
                  onChange={(e) => setTermenLimita(e.target.value)}
                  disabled={isViewer}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="persoana">Persoana legata</Label>
              <Input
                id="persoana"
                value={persoanaLegata}
                onChange={(e) => setPersoanaLegata(e.target.value)}
                placeholder="Numele persoanei legate"
                disabled={isViewer}
              />
            </div>

            {/* Destinatari with statuses */}
            <div className="space-y-3">
              <Label>Destinatari</Label>

              {/* My status controls */}
              {myDestinatar && !isViewer && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-sm font-medium">Statusul tau:</span>
                  <StatusIndicatieBadge status={myDestinatar.status} />
                  {getNextStatuses(myDestinatar.status).map(s => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(s.value)}
                      disabled={updatingStatus}
                    >
                      {updatingStatus ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      {s.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Existing destinatari with their statuses */}
              <div className="border rounded-md divide-y">
                {indicatie.destinatari.map(dest => (
                  <div key={dest.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{dest.destinatar_details.full_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIndicatieBadge status={dest.status} />
                      {dest.data_indeplinire && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(dest.data_indeplinire)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Edit destinatari (for creator) */}
              {(isCreator || !isViewer) && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Modifica destinatari
                  </summary>
                  <div className="border rounded-md mt-2 max-h-[200px] overflow-y-auto">
                    {users.map(user => (
                      <div
                        key={user.id}
                        onClick={() => toggleDestinatar(user.id)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-b-0',
                          selectedDestinatari.includes(user.id) && 'bg-blue-50'
                        )}
                      >
                        <div className={cn(
                          'h-5 w-5 rounded border flex items-center justify-center',
                          selectedDestinatari.includes(user.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        )}>
                          {selectedDestinatari.includes(user.id) && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-sm">{user.full_name}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Meta info */}
            <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
              <p>Creata de {indicatie.created_by_details.full_name} la {formatDateTime(indicatie.created_at)}</p>
              {indicatie.persoana_legata_name && (
                <p>Persoana legata: {indicatie.persoana_legata_name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right - Comments & Files */}
        <div className="w-96 border-l bg-muted/30 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('comentarii')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === 'comentarii'
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Comentarii ({indicatie.comentarii?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('fisiere')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === 'fisiere'
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Paperclip className="h-4 w-4" />
              Fisiere ({indicatie.fisiere?.length || 0})
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'comentarii' ? (
              <div className="space-y-4">
                {indicatie.comentarii && indicatie.comentarii.length > 0 ? (
                  indicatie.comentarii.map(com => (
                    <div key={com.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{com.autor_details.full_name}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(com.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{com.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nu exista comentarii inca
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {indicatie.fisiere && indicatie.fisiere.length > 0 ? (
                  indicatie.fisiere.map(fisier => (
                    <div key={fisier.id} className="flex items-center gap-3 p-2 border rounded-md">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fisier.nume_fisier}</p>
                        <p className="text-xs text-muted-foreground">
                          {fisier.uploaded_by_details.full_name} - {formatDateTime(fisier.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={fisier.fisier.startsWith('http') ? fisier.fisier : `${API_URL}${fisier.fisier}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <Download className="h-3 w-3" />
                          </Button>
                        </a>
                        {!isViewer && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFile(fisier.id)}
                          >
                            <X className="h-3 w-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nu exista fisiere inca
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bottom input area */}
          <div className="p-4 border-t space-y-3">
            {activeTab === 'comentarii' ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Adauga un comentariu..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                  disabled={isViewer}
                />
                <Button
                  size="icon"
                  onClick={handleAddComment}
                  disabled={isViewer || sendingComment || !comment.trim()}
                >
                  {sendingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isViewer || uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Incarca fisier
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
