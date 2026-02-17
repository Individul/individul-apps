'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, Calendar, User, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import {
  transfersApi,
  TransferDetail,
  TransferUpdate,
  PenitentiaryOption,
} from '@/lib/api'

interface RowData {
  penitentiary: number
  label: string
  is_isolator: boolean
  veniti_reintorsi: number
  veniti_noi: number
  plecati: number
  plecati_izolator: number
  notes: string
}

export default function TransferDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [transfer, setTransfer] = useState<TransferDetail | null>(null)
  const [transferDate, setTransferDate] = useState<Date | undefined>()
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<RowData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    setLoading(true)
    try {
      const [detail, pens] = await Promise.all([
        transfersApi.get(token, id),
        transfersApi.penitentiaries(token),
      ])

      setTransfer(detail)
      setTransferDate(new Date(detail.transfer_date))
      setDescription(detail.description || '')

      // Build rows from penitentiaries, pre-populated with entry data
      const entryMap = new Map(
        detail.entries.map(e => [e.penitentiary, e])
      )

      const newRows: RowData[] = pens.map(p => {
        const entry = entryMap.get(p.value)
        return {
          penitentiary: p.value,
          label: p.label,
          is_isolator: p.is_isolator,
          veniti_reintorsi: entry?.veniti_reintorsi || 0,
          veniti_noi: entry?.veniti_noi || 0,
          plecati: entry?.plecati || 0,
          plecati_izolator: entry?.plecati_izolator || 0,
          notes: entry?.notes || '',
        }
      })

      setRows(newRows)
    } catch {
      toast.error('Eroare la incarcarea transferului')
      router.push('/transferuri')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateRow = (idx: number, field: keyof RowData, value: number | string) => {
    setRows(prev => {
      const newRows = [...prev]
      newRows[idx] = { ...newRows[idx], [field]: value }
      return newRows
    })
  }

  const handleSave = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    if (!transferDate) {
      toast.error('Selectati data transferului')
      return
    }

    setSaving(true)
    try {
      const data: TransferUpdate = {
        transfer_date: format(transferDate, 'yyyy-MM-dd'),
        description: description || undefined,
        entries: rows.map(r => ({
          penitentiary: r.penitentiary,
          veniti: r.veniti_reintorsi + r.veniti_noi,
          veniti_reintorsi: r.veniti_reintorsi,
          veniti_noi: r.veniti_noi,
          plecati: r.plecati,
          plecati_izolator: r.is_isolator ? r.plecati_izolator : 0,
          notes: r.notes || undefined,
        })),
      }
      await transfersApi.update(token, id, data)
      toast.success('Transfer actualizat cu succes')
      router.push('/transferuri')
    } catch (err: any) {
      toast.error(err.message || 'Eroare la salvare')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setDeleting(true)
    try {
      await transfersApi.delete(token, id)
      toast.success('Transfer sters cu succes')
      router.push('/transferuri')
    } catch (err: any) {
      toast.error(err.message || 'Eroare la stergere')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: ro })
    } catch {
      return dateStr
    }
  }

  // Calculate totals
  const totals = rows.reduce(
    (acc, r) => ({
      veniti: acc.veniti + r.veniti_reintorsi + r.veniti_noi,
      reintorsi: acc.reintorsi + r.veniti_reintorsi,
      noi: acc.noi + r.veniti_noi,
      plecati: acc.plecati + r.plecati,
      izolator: acc.izolator + (r.is_isolator ? r.plecati_izolator : 0),
    }),
    { veniti: 0, reintorsi: 0, noi: 0, plecati: 0, izolator: 0 }
  )

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-32" /><Skeleton className="h-96" /></div>
  }

  if (!transfer) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/transferuri">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Editare transfer</h1>
            <p className="text-sm text-slate-500 mt-1">Modificati datele transferului</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Sterge
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmare stergere</DialogTitle>
                <DialogDescription>
                  Sigur doriti sa stergeti acest transfer? Aceasta actiune nu poate fi anulata.
                  Toate datele asociate vor fi pierdute.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Anuleaza
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Se sterge...' : 'Sterge definitiv'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Se salveaza...' : 'Salveaza'}
          </Button>
        </div>
      </div>

      {/* Transfer Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalii transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-start gap-6">
            <div className="w-[220px]">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Data transferului</label>
              <div className="mt-1">
                <DatePicker
                  date={transferDate}
                  onSelect={setTransferDate}
                  placeholder="Selecteaza data"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[300px]">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Descriere (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ex: Transfer lot 1, Transfer urgenta..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <User className="h-3.5 w-3.5" />
              <span>Creat de <span className="text-slate-600 font-medium">{transfer.created_by_name}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>Creat la {formatDateTime(transfer.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Ultima modificare {formatDateTime(transfer.updated_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[50px] text-center">Nr.</TableHead>
                <TableHead className="w-[240px]">Penitenciar</TableHead>
                <TableHead className="text-center w-[100px] bg-blue-50/50">Veniti</TableHead>
                <TableHead className="text-center w-[100px]">Reintorsi</TableHead>
                <TableHead className="text-center w-[100px]">Noi</TableHead>
                <TableHead className="text-center w-[100px]">Plecati</TableHead>
                <TableHead className="text-center w-[100px]">La izolator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={row.penitentiary} className={row.is_isolator ? 'bg-amber-50/30' : ''}>
                  <TableCell className="text-center text-slate-500 text-sm">{idx + 1}</TableCell>
                  <TableCell className="font-medium text-sm">
                    {row.label}
                    {row.is_isolator && (
                      <Badge variant="outline" className="ml-2 text-[10px] border-amber-300 text-amber-600">
                        Izolator
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center bg-blue-50/30">
                    <span className="font-semibold text-blue-700">
                      {row.veniti_reintorsi + row.veniti_noi}
                    </span>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min={0}
                      value={row.veniti_reintorsi || ''}
                      onChange={(e) => updateRow(idx, 'veniti_reintorsi', parseInt(e.target.value) || 0)}
                      className="text-center h-8 w-full"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min={0}
                      value={row.veniti_noi || ''}
                      onChange={(e) => updateRow(idx, 'veniti_noi', parseInt(e.target.value) || 0)}
                      className="text-center h-8 w-full"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min={0}
                      value={row.plecati || ''}
                      onChange={(e) => updateRow(idx, 'plecati', parseInt(e.target.value) || 0)}
                      className="text-center h-8 w-full"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    {row.is_isolator ? (
                      <Input
                        type="number"
                        min={0}
                        value={row.plecati_izolator || ''}
                        onChange={(e) => updateRow(idx, 'plecati_izolator', parseInt(e.target.value) || 0)}
                        className="text-center h-8 w-full border-amber-200 focus:border-amber-400"
                        placeholder="0"
                      />
                    ) : (
                      <div className="text-center text-slate-300">&ndash;</div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals */}
              <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                <TableCell></TableCell>
                <TableCell className="font-bold text-slate-900">TOTAL</TableCell>
                <TableCell className="text-center font-bold text-blue-700 bg-blue-50/50">{totals.veniti}</TableCell>
                <TableCell className="text-center font-bold text-slate-700">{totals.reintorsi}</TableCell>
                <TableCell className="text-center font-bold text-slate-700">{totals.noi}</TableCell>
                <TableCell className="text-center font-bold text-slate-900">{totals.plecati}</TableCell>
                <TableCell className="text-center font-bold text-amber-600">{totals.izolator}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
