'use client'

import { useEffect, useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  BarChart3,
  Users,
  Clock,
  AlertTriangle,
  Calendar,
  Bell,
} from 'lucide-react'
import { toast } from 'sonner'

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DatePicker } from '@/components/ui/date-picker'
import { petitionsApi, personsApi, PetitionStats } from '@/lib/api'
import { formatDateForApi } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Petitii constants
// ---------------------------------------------------------------------------

const statusLabels: Record<string, string> = {
  inregistrata: 'Inregistrata',
  in_examinare: 'In examinare',
  solutionata: 'Solutionata',
  respinsa: 'Respinsa',
  redirectionata: 'Redirectionata',
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

// ---------------------------------------------------------------------------
// Termene constants
// ---------------------------------------------------------------------------

const REPORT_TYPES = [
  {
    id: 'persons',
    title: 'Lista Persoanelor',
    description: 'Contine toate persoanele active cu date personale si numarul de sentinte.',
    icon: Users,
  },
  {
    id: 'upcoming',
    title: 'Termene Apropiate',
    description: 'Fractii cu termene in urmatoarele 30 de zile, ordonate cronologic.',
    icon: Clock,
  },
  {
    id: 'overdue',
    title: 'Termene Depasite',
    description: 'Fractii cu termene depasite care necesita atentie imediata.',
    icon: AlertTriangle,
  },
  {
    id: 'mai_notifications',
    title: 'Instiintari MAI',
    description: 'Persoanele care au notificare MAI activa.',
    icon: Bell,
  },
] as const

type ReportType = typeof REPORT_TYPES[number]['id']

// ===========================================================================
// Page component
// ===========================================================================

export default function ReportsPage() {
  // ---- Petitii state ----
  const [stats, setStats] = useState<PetitionStats | null>(null)
  const [petitiiStatus, setPetitiiStatus] = useState('all')
  const [petitiiDateFrom, setPetitiiDateFrom] = useState('')
  const [petitiiDateTo, setPetitiiDateTo] = useState('')

  // ---- Termene state ----
  const [selectedReport, setSelectedReport] = useState<ReportType>('persons')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [termeneStatus, setTermeneStatus] = useState<string>('')
  const [fractionType, setFractionType] = useState<string>('')
  const [isExporting, setIsExporting] = useState<'pdf' | 'xlsx' | null>(null)

  // ---- Load petition stats on mount ----
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    petitionsApi
      .stats(token)
      .then(setStats)
      .catch(() => {})
  }, [])

  // =========================================================================
  // Petitii export handlers
  // =========================================================================

  const buildPetitiiExportParams = () => {
    const params = new URLSearchParams()
    if (petitiiStatus && petitiiStatus !== 'all') params.set('status', petitiiStatus)
    if (petitiiDateFrom) params.set('registration_date__gte', petitiiDateFrom)
    if (petitiiDateTo) params.set('registration_date__lte', petitiiDateTo)
    return params
  }

  const handlePetitiiExportXlsx = () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    window.open(petitionsApi.exportXlsx(token, buildPetitiiExportParams()), '_blank')
  }

  const handlePetitiiExportPdf = () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    window.open(petitionsApi.exportPdf(token, buildPetitiiExportParams()), '_blank')
  }

  // =========================================================================
  // Termene export handlers
  // =========================================================================

  const handleTermeneExportXlsx = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setIsExporting('xlsx')

    try {
      const params = new URLSearchParams()
      if (selectedReport === 'mai_notifications') {
        params.set('mai_notification', 'true')
      } else {
        if (startDate) {
          params.set('admission_date__gte', formatDateForApi(startDate))
        }
        if (endDate) {
          params.set('admission_date__lte', formatDateForApi(endDate))
        }
      }
      params.set('report_type', selectedReport)

      await personsApi.exportXlsx(token, params)
      toast.success('Exportul XLSX a inceput')
    } finally {
      setIsExporting(null)
    }
  }

  const handleTermeneExportPdf = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setIsExporting('pdf')

    try {
      const params = new URLSearchParams()
      if (selectedReport === 'mai_notifications') {
        params.set('mai_notification', 'true')
      } else {
        if (startDate) {
          params.set('admission_date__gte', formatDateForApi(startDate))
        }
        if (endDate) {
          params.set('admission_date__lte', formatDateForApi(endDate))
        }
      }
      params.set('report_type', selectedReport)

      await personsApi.exportPdf(token, params)
      toast.success('Exportul PDF a inceput')
    } finally {
      setIsExporting(null)
    }
  }

  const selectedReportInfo = REPORT_TYPES.find((r) => r.id === selectedReport)

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rapoarte</h1>

      <Tabs defaultValue="petitii">
        <TabsList>
          <TabsTrigger value="petitii">Petitii</TabsTrigger>
          <TabsTrigger value="termene">Termene</TabsTrigger>
        </TabsList>

        {/* =============================================================== */}
        {/* Petitii tab                                                     */}
        {/* =============================================================== */}
        <TabsContent value="petitii">
          <div className="space-y-6">
            {/* Statistics overview */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total petitii
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.total || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Scadente in curand
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">
                    {stats?.due_soon || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Termen depasit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {stats?.overdue || 0}
                  </div>
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
                    {stats?.by_status &&
                      Object.entries(stats.by_status).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm">{statusLabels[key] || key}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{
                                  width: `${(value / (stats.total || 1)) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8 text-right">
                              {value}
                            </span>
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
                    {stats?.by_object_type &&
                      Object.entries(stats.by_object_type).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm">
                            {objectTypeLabels[key] || key}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{
                                  width: `${(value / (stats.total || 1)) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8 text-right">
                              {value}
                            </span>
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
                    Pe sector detentie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats?.by_detention_sector &&
                      Object.entries(stats.by_detention_sector)
                        .sort((a, b) => Number(a[0]) - Number(b[0]))
                        .map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm">
                              {detentionSectorLabels[key] || `Sector ${key}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{
                                    width: `${(value / (stats.total || 1)) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm font-medium w-8 text-right">
                                {value}
                              </span>
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
                  Generati rapoarte in format XLSX sau PDF pe baza filtrelor selectate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={petitiiStatus} onValueChange={setPetitiiStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Toate" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toate</SelectItem>
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>De la data</Label>
                    <Input
                      type="date"
                      value={petitiiDateFrom}
                      onChange={(e) => setPetitiiDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pana la data</Label>
                    <Input
                      type="date"
                      value={petitiiDateTo}
                      onChange={(e) => setPetitiiDateTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={handlePetitiiExportXlsx}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export XLSX
                  </Button>
                  <Button variant="outline" onClick={handlePetitiiExportPdf}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =============================================================== */}
        {/* Termene tab                                                     */}
        {/* =============================================================== */}
        <TabsContent value="termene">
          <div className="space-y-8">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Centru de Raportare
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Genereaza rapoarte personalizate in format PDF sau Excel
              </p>
            </div>

            {/* Section 1: Select Report Type */}
            <div>
              <h2 className="text-sm uppercase tracking-wide text-slate-500 font-bold mb-4">
                1. Selecteaza Raportul
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {REPORT_TYPES.map((report) => {
                  const Icon = report.icon
                  const isSelected = selectedReport === report.id

                  return (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report.id)}
                      className={`text-left p-5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-slate-900 border-transparent bg-slate-50'
                          : 'bg-white border-gray-200 hover:border-slate-400 hover:shadow-md'
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-md flex items-center justify-center mb-3 ${
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : 'bg-gray-50 text-slate-700'
                        }`}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-slate-900">
                        {report.title}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {report.description}
                      </p>

                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <span className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                          Selectat
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Section 2: Configure Parameters */}
            <div>
              <h2 className="text-sm uppercase tracking-wide text-slate-500 font-bold mb-4">
                2. Filtreaza Datele
              </h2>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="space-y-6">
                  {/* Date Range Row */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-3">
                      Interval de Date
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">
                          De la
                        </label>
                        <div className="relative">
                          <Calendar
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                            strokeWidth={1.5}
                          />
                          <DatePicker
                            date={startDate}
                            onSelect={setStartDate}
                            placeholder="Data de inceput"
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">
                          Pana la
                        </label>
                        <div className="relative">
                          <Calendar
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                            strokeWidth={1.5}
                          />
                          <DatePicker
                            date={endDate}
                            onSelect={setEndDate}
                            placeholder="Data de sfarsit"
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filters Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                        Status Sentinta
                      </label>
                      <Select value={termeneStatus} onValueChange={setTermeneStatus}>
                        <SelectTrigger className="w-full h-10 bg-white border border-gray-200 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-slate-500 focus:border-slate-500">
                          <SelectValue placeholder="Toate statusurile" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toate statusurile</SelectItem>
                          <SelectItem value="active">Activa</SelectItem>
                          <SelectItem value="suspended">Suspendata</SelectItem>
                          <SelectItem value="completed">Finalizata</SelectItem>
                          <SelectItem value="conditionally_released">
                            Liberare conditionata
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                        Tip Fractie
                      </label>
                      <Select value={fractionType} onValueChange={setFractionType}>
                        <SelectTrigger className="w-full h-10 bg-white border border-gray-200 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-slate-500 focus:border-slate-500">
                          <SelectValue placeholder="Toate fractiile" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toate fractiile</SelectItem>
                          <SelectItem value="1/3">
                            1/3 - Liberare conditionata
                          </SelectItem>
                          <SelectItem value="1/2">
                            1/2 - Schimbare regim
                          </SelectItem>
                          <SelectItem value="2/3">
                            2/3 - Liberare (infractiuni grave)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Export Action Bar */}
            <div>
              <h2 className="text-sm uppercase tracking-wide text-slate-500 font-bold mb-4">
                3. Exporta Raportul
              </h2>

              <div className="bg-slate-50 border border-gray-200 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Report Summary */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-gray-200 rounded-md flex items-center justify-center">
                      {selectedReportInfo && (
                        <selectedReportInfo.icon
                          className="h-5 w-5 text-slate-600"
                          strokeWidth={1.5}
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {selectedReportInfo?.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {startDate || endDate
                          ? 'Filtrat pe interval de date'
                          : 'Toate inregistrarile'}
                      </p>
                    </div>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTermeneExportPdf}
                      disabled={isExporting !== null}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExporting === 'pdf' ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generare...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" strokeWidth={2} />
                          Export PDF
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleTermeneExportXlsx}
                      disabled={isExporting !== null}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExporting === 'xlsx' ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generare...
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
                          Export XLSX
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Info */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>
                      Raportul va fi descarcat automat in formatul selectat
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Report Preview Hint */}
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-gray-300" strokeWidth={1} />
              </div>
              <h3 className="text-sm font-medium text-slate-700 mb-1">
                Previzualizare Raport
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Selecteaza tipul raportului si parametrii, apoi apasa pe butonul de
                export pentru a genera documentul.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
