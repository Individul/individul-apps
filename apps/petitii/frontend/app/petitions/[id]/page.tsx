'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  Download,
  Loader2,
  Edit,
  Save,
  AlertTriangle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AppLayout } from '@/components/layout/app-layout'
import { petitionsApi, Petition, ApiError } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/utils'

const statusOptions = [
  { value: 'inregistrata', label: 'Înregistrată' },
  { value: 'in_examinare', label: 'În examinare' },
  { value: 'solutionata', label: 'Soluționată' },
  { value: 'respinsa', label: 'Respinsă' },
  { value: 'redirectionata', label: 'Redirecționată' },
]

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  inregistrata: 'default',
  in_examinare: 'warning',
  solutionata: 'success',
  respinsa: 'destructive',
  redirectionata: 'secondary',
}

export default function PetitionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [petition, setPetition] = useState<Petition | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [status, setStatus] = useState<string | undefined>(undefined)
  const [resolutionDate, setResolutionDate] = useState('')
  const [resolutionText, setResolutionText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const petitionId = params.id as string | undefined

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    if (!petitionId) return

    petitionsApi.get(token, petitionId)
      .then((data) => {
        setPetition(data)
        setStatus(data.status)
        setResolutionDate(data.resolution_date || '')
        setResolutionText(data.resolution_text || '')
      })
      .catch(() => {
        toast.error('Nu s-a putut încărca petiția')
        router.push('/petitions')
      })
      .finally(() => setLoading(false))
  }, [router, petitionId])

  const handleSave = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !petition) return

    setSaving(true)
    try {
      const updated = await petitionsApi.update(token, petition.id, {
        status,
        resolution_date: resolutionDate || null,
        resolution_text: resolutionText,
      })
      setPetition(updated)
      setEditing(false)
      toast.success('Petiția a fost actualizată')
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare la salvare')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const token = localStorage.getItem('access_token')
    const file = event.target.files?.[0]
    if (!token || !petition || !file) return

    setUploading(true)
    try {
      await petitionsApi.uploadAttachment(token, petition.id, file)
      const updated = await petitionsApi.get(token, petition.id)
      setPetition(updated)
      toast.success('Fișierul a fost încărcat')
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare la încărcare')
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    const token = localStorage.getItem('access_token')
    if (!token || !petition) return

    if (!confirm('Sigur doriți să ștergeți acest fișier?')) return

    try {
      await petitionsApi.deleteAttachment(token, petition.id, attachmentId)
      const updated = await petitionsApi.get(token, petition.id)
      setPetition(updated)
      toast.success('Fișierul a fost șters')
    } catch (error) {
      toast.error('A apărut o eroare la ștergere')
    }
  }

  const handleDeletePetition = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !petition) return

    if (!confirm(`Sigur doriți să ștergeți petiția ${petition.registration_number}? Această acțiune este ireversibilă.`)) return

    setDeleting(true)
    try {
      await petitionsApi.delete(token, petition.id)
      toast.success('Petiția a fost ștearsă')
      router.push('/petitions')
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare la ștergere')
      }
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    )
  }

  if (!petition) return null

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/petitions">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold">{petition.registration_number}</h1>
              <p className="text-sm text-muted-foreground">
                Înregistrată la {formatDate(petition.registration_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariants[petition.status] || 'default'} className="text-sm">
              {petition.status_display}
            </Badge>
            {petition.is_overdue && (
              <Badge variant="destructive">Termen depășit</Badge>
            )}
            {petition.is_due_soon && !petition.is_overdue && (
              <Badge variant="warning">{petition.days_until_due} zile rămase</Badge>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeletePetition}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {!deleting && 'Șterge'}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Petition details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalii petiție</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Tip petiționar</Label>
                <p className="font-medium">{petition.petitioner_type_display}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Nume petiționar</Label>
                <p className="font-medium">{petition.petitioner_name}</p>
              </div>
              {petition.detainee_fullname && (
                <div>
                  <Label className="text-muted-foreground">Nume deținut</Label>
                  <p className="font-medium">{petition.detainee_fullname}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Obiect</Label>
                <p className="font-medium">{petition.object_type_display}</p>
              </div>
              {petition.object_description && (
                <div>
                  <Label className="text-muted-foreground">Descriere</Label>
                  <p className="text-sm">{petition.object_description}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Termen răspuns</Label>
                <p className="font-medium">{formatDate(petition.response_due_date)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Creat de</Label>
                <p className="text-sm">{petition.created_by_name} la {formatDateTime(petition.created_at)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Status and resolution */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Status și rezoluție</CardTitle>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editare
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    Anulare
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvare
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                {editing && status ? (
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium">{petition.status_display}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data rezoluției</Label>
                {editing ? (
                  <Input
                    type="date"
                    value={resolutionDate}
                    onChange={(e) => setResolutionDate(e.target.value)}
                  />
                ) : (
                  <p>{petition.resolution_date ? formatDate(petition.resolution_date) : '-'}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Text rezoluție</Label>
                {editing ? (
                  <Textarea
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    rows={4}
                    placeholder="Introduceți textul rezoluției..."
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {petition.resolution_text || '-'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attachments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Fișiere atașate</CardTitle>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Încarcă fișier
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {petition.attachments && petition.attachments.length > 0 ? (
              <div className="space-y-2">
                {petition.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{attachment.original_filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {(attachment.size_bytes / 1024).toFixed(1)} KB •
                          Încărcat de {attachment.uploaded_by_name} la {formatDateTime(attachment.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAttachment(attachment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nu există fișiere atașate
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
