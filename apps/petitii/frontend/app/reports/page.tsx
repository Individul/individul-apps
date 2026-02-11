'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileSpreadsheet, FileText, BarChart3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppLayout } from '@/components/layout/app-layout'
import { petitionsApi, PetitionStats } from '@/lib/api'

const statusLabels: Record<string, string> = {
  inregistrata: 'Înregistrată',
  in_examinare: 'În examinare',
  solutionata: 'Soluționată',
  respinsa: 'Respinsă',
  redirectionata: 'Redirecționată',
}

const objectTypeLabels: Record<string, string> = {
  art_91: 'Art. 91',
  art_92: 'Art. 92',
  amnistie: 'Amnistie',
  transfer: 'Transfer',
  executare: 'Executare',
  copii_dosar: 'Copii dosar',
  copii_acte: 'Copii acte',
  altele: 'Altele',
}

const detentionSectorLabels: Record<string, string> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [String(i + 1), `Sector ${i + 1}`])
)

export default function ReportsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<PetitionStats | null>(null)
  const [status, setStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    petitionsApi.stats(token)
      .then(setStats)
      .catch(() => {})
  }, [router])

  const buildExportParams = () => {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (dateFrom) params.set('registration_date__gte', dateFrom)
    if (dateTo) params.set('registration_date__lte', dateTo)
    return params
  }

  const handleExportXlsx = () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    window.open(petitionsApi.exportXlsx(token, buildExportParams()), '_blank')
  }

  const handleExportPdf = () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    window.open(petitionsApi.exportPdf(token, buildExportParams()), '_blank')
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Rapoarte</h1>

        {/* Statistics overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total petiții
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Scadente în curând
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{stats?.due_soon || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Termen depășit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats?.overdue || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Stats by status, type and detention sector */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Pe status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.by_status && Object.entries(stats.by_status).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{statusLabels[key] || key}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(value / (stats.total || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Pe tip obiect
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.by_object_type && Object.entries(stats.by_object_type).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{objectTypeLabels[key] || key}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(value / (stats.total || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Pe sector detenție
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.by_detention_sector && Object.entries(stats.by_detention_sector)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{detentionSectorLabels[key] || `Sector ${key}`}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(value / (stats.total || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export rapoarte</CardTitle>
            <CardDescription>
              Generați rapoarte în format XLSX sau PDF pe baza filtrelor selectate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate</SelectItem>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>De la data</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Până la data</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={handleExportXlsx}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export XLSX
              </Button>
              <Button variant="outline" onClick={handleExportPdf}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
