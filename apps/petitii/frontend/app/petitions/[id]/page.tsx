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
  CheckCircle,
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

const petitionerTypes = [
  { value: 'condamnat', label: 'Condamnat' },
  { value: 'ruda', label: 'Ruda' },
  { value: 'avocat', label: 'Avocat' },
  { value: 'organ_stat', label: 'Organ de stat' },
  { value: 'altul', label: 'Altul' },
]

const objectTypes = [
  { value: 'art_91', label: 'Art. 91 (Liberare conditionata)' },
  { value: 'art_92', label: 'Art. 92 (Intreruperea executarii)' },
  { value: 'amnistie', label: 'Amnistie' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'executare', label: 'Executarea pedepsei' },
  { value: 'copii_dosar', label: 'Copii dosar' },
  { value: 'copii_acte', label: 'Copii acte' },
  { value: 'altele', label: 'Altele' },
]

const detentionSectors = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Sector ${i + 1}`,
}))

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
  const [editingDetails, setEditingDetails] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [petitionerType, setPetitionerType] = useState<string | undefined>(undefined)
  const [petitionerName, setPetitionerName] = useState('')
  const [detaineeFullname, setDetaineeFullname] = useState('')
  const [detentionSector, setDetentionSector] = useState('')
  const [objectType, setObjectType] = useState<string | undefined>(undefined)
  const [objectDescription, setObjectDescription] = useState('')

  const [status, setStatus] = useState<string | undefined>(undefined)
  const [resolutionDate, setResolutionDate] = useState('')
  const [resolutionText, setResolutionText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [finalizing, setFinalizing] = useState(false)

  const petitionId = params.id as string | undefined
  const headerActionClass = 'h-10 px-4 rounded-md text-sm font-medium'

  const resetDetailsForm = (data: Petition) => {
    setPetitionerType(data.petitioner_type)
    setPetitionerName(data.petitioner_name || '')
    setDetaineeFullname(data.detainee_fullname || '')
    setDetentionSector(String(data.detention_sector || 1))
    setObjectType(data.object_type)
    setObjectDescription(data.object_description || '')
  }

  const resetStatusForm = (data: Petition) => {
    setStatus(data.status)
    setResolutionDate(data.resolution_date || '')
    setResolutionText(data.resolution_text || '')
  }

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
        resetDetailsForm(data)
        resetStatusForm(data)
      })
      .catch(() => {
        toast.error('Nu s-a putut încărca petiția')
        router.push('/petitions')
      })
      .finally(() => setLoading(false))
  }, [router, petitionId])

  const handleCancelDetailsEdit = () => {
    if (!petition) return
    resetDetailsForm(petition)
    setEditingDetails(false)
  }

  const handleSaveDetails = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !petition || !petitionerType || !objectType || !petitionerName.trim() || !detentionSector) return

    setSavingDetails(true)
    try {
      const updated = await petitionsApi.update(token, petition.id, {
        petitioner_type: petitionerType,
        petitioner_name: petitionerName.trim(),
        detainee_fullname: detaineeFullname.trim(),
        detention_sector: Number(detentionSector),
        object_type: objectType,
        object_description: objectDescription.trim(),
      })
      setPetition(updated)
      resetDetailsForm(updated)
      setEditingDetails(false)
      toast.success('Detaliile petitiei au fost actualizate')
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A aparut o eroare la salvare')
      }
    } finally {
      setSavingDetails(false)
    }
  }

  const handleCancelStatusEdit = () => {
    if (!petition) return
    resetStatusForm(petition)
    setEditingStatus(false)
  }

  const handleSaveStatus = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !petition) return

    setSavingStatus(true)
    try {
      const updated = await petitionsApi.update(token, petition.id, {
        status,
        resolution_date: resolutionDate || null,
        resolution_text: resolutionText,
      })
      setPetition(updated)
      resetStatusForm(updated)
      setEditingStatus(false)
      toast.success('Petiția a fost actualizată')
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare la salvare')
      }
    } finally {
      setSavingStatus(false)
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

  const handleDownloadAttachment = async (attachmentId: string, filename: string) => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
    try {
      const response = await fetch(`${API_URL}/api/petitions/attachments/${attachmentId}/download/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast.error('A apărut o eroare la descărcare')
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

  const handleFinalize = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !petition) return

    if (!confirm('Sigur doriți să marcați petiția ca finalizată?')) return

    setFinalizing(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const updated = await petitionsApi.update(token, petition.id, {
        status: 'solutionata',
        resolution_date: today,
      })
      setPetition(updated)
      resetStatusForm(updated)
      toast.success('Petiția a fost marcată ca finalizată')
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare')
      }
    } finally {
      setFinalizing(false)
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
            <Badge
              variant={statusVariants[petition.status] || 'default'}
              className={headerActionClass}
            >
              {petition.status_display}
            </Badge>
            {petition.is_overdue && (
              <Badge variant="destructive" className={headerActionClass}>
                Termen depășit
              </Badge>
            )}
            {petition.is_due_soon && !petition.is_overdue && (
              <Badge variant="warning" className={headerActionClass}>
                {petition.days_until_due} zile rămase
              </Badge>
            )}
            {petition.status !== 'solutionata' && (
              <Button
                variant="default"
                size="default"
                onClick={handleFinalize}
                disabled={finalizing}
                className="h-10 px-4 bg-green-600 hover:bg-green-700"
              >
                {finalizing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Marchează ca finalizată
              </Button>
            )}
            <Button
              variant="destructive"
              size="default"
              onClick={handleDeletePetition}
              disabled={deleting}
              className="h-10 px-4"
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Detalii petiție</CardTitle>
              {!editingDetails ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingDetails(true)}
                  disabled={editingStatus}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editare
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelDetailsEdit}>
                    Anulare
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveDetails}
                    disabled={savingDetails || !petitionerType || !objectType || !detentionSector || petitionerName.trim().length === 0}
                  >
                    {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvare
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Tip petiționar</Label>
                {editingDetails ? (
                  <Select value={petitionerType} onValueChange={setPetitionerType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selectati tipul petitionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {petitionerTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium">{petition.petitioner_type_display}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Nume petiționar</Label>
                {editingDetails ? (
                  <Input
                    value={petitionerName}
                    onChange={(e) => setPetitionerName(e.target.value)}
                    placeholder="Numele complet al petitionarului"
                  />
                ) : (
                  <p className="font-medium">{petition.petitioner_name}</p>
                )}
              </div>
              {(editingDetails || petition.detainee_fullname) && (
                <div>
                  <Label className="text-muted-foreground">Nume deținut</Label>
                  {editingDetails ? (
                    <Input
                      value={detaineeFullname}
                      onChange={(e) => setDetaineeFullname(e.target.value)}
                      placeholder="Numele complet al detinutului"
                    />
                  ) : (
                    <p className="font-medium">{petition.detainee_fullname}</p>
                  )}
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Sector detenție</Label>
                {editingDetails ? (
                  <Select value={detentionSector} onValueChange={setDetentionSector}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selectati sectorul de detentie" />
                    </SelectTrigger>
                    <SelectContent>
                      {detentionSectors.map((sector) => (
                        <SelectItem key={sector.value} value={sector.value}>
                          {sector.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium">{petition.detention_sector_display}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Obiect</Label>
                {editingDetails ? (
                  <Select value={objectType} onValueChange={setObjectType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selectati tipul obiect" />
                    </SelectTrigger>
                    <SelectContent>
                      {objectTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium">{petition.object_type_display}</p>
                )}
              </div>
              {(editingDetails || petition.object_description) && (
                <div>
                  <Label className="text-muted-foreground">Descriere</Label>
                  {editingDetails ? (
                    <Textarea
                      value={objectDescription}
                      onChange={(e) => setObjectDescription(e.target.value)}
                      rows={3}
                      placeholder="Detalii suplimentare despre obiectul petitiei"
                    />
                  ) : (
                    <p className="text-sm">{petition.object_description}</p>
                  )}
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
              {!editingStatus ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingStatus(true)}
                  disabled={editingDetails}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editare
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelStatusEdit}>
                    Anulare
                  </Button>
                  <Button size="sm" onClick={handleSaveStatus} disabled={savingStatus}>
                    {savingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvare
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                {editingStatus && status ? (
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
                {editingStatus ? (
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
                {editingStatus ? (
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadAttachment(attachment.id, attachment.original_filename)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
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
