'use client'

import { useState } from 'react'
import { Users, Clock, AlertTriangle, FileText, FileSpreadsheet, Calendar, Download, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { personsApi } from '@/lib/api'
import { formatDateForApi } from '@/lib/utils'

// Report types configuration
const REPORT_TYPES = [
  {
    id: 'persons',
    title: 'Lista Persoanelor',
    description: 'Conține toate persoanele active cu date personale și numărul de sentințe.',
    icon: Users,
  },
  {
    id: 'upcoming',
    title: 'Termene Apropiate',
    description: 'Fracții cu termene în următoarele 30 de zile, ordonate cronologic.',
    icon: Clock,
  },
  {
    id: 'overdue',
    title: 'Termene Depășite',
    description: 'Fracții cu termene depășite care necesită atenție imediată.',
    icon: AlertTriangle,
  },
  {
    id: 'mai_notifications',
    title: 'Înștiințări MAI',
    description: 'Persoanele care au notificare MAI activă.',
    icon: Bell,
  },
] as const

type ReportType = typeof REPORT_TYPES[number]['id']

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('persons')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [status, setStatus] = useState<string>('')
  const [fractionType, setFractionType] = useState<string>('')
  const [isExporting, setIsExporting] = useState<'pdf' | 'xlsx' | null>(null)

  const handleExportXlsx = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setIsExporting('xlsx')

    try {
      const params = new URLSearchParams()
      if (startDate) {
        params.set('admission_date__gte', formatDateForApi(startDate))
      }
      if (endDate) {
        params.set('admission_date__lte', formatDateForApi(endDate))
      }
      params.set('report_type', selectedReport)
      if (selectedReport === 'mai_notifications') {
        params.set('mai_notification', 'true')
      }

      await personsApi.exportXlsx(token, params)
      toast.success('Exportul XLSX a început')
    } finally {
      setIsExporting(null)
    }
  }

  const handleExportPdf = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setIsExporting('pdf')

    try {
      const params = new URLSearchParams()
      if (startDate) {
        params.set('admission_date__gte', formatDateForApi(startDate))
      }
      if (endDate) {
        params.set('admission_date__lte', formatDateForApi(endDate))
      }
      params.set('report_type', selectedReport)
      if (selectedReport === 'mai_notifications') {
        params.set('mai_notification', 'true')
      }

      await personsApi.exportPdf(token, params)
      toast.success('Exportul PDF a început')
    } finally {
      setIsExporting(null)
    }
  }

  const selectedReportInfo = REPORT_TYPES.find(r => r.id === selectedReport)

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Centru de Raportare
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generează rapoarte personalizate în format PDF sau Excel
          </p>
        </div>

        {/* Section 1: Select Report Type */}
        <div>
          <h2 className="text-sm uppercase tracking-wide text-slate-500 font-bold mb-4">
            1. Selectează Raportul
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
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center mb-3 ${
                    isSelected ? 'bg-slate-900 text-white' : 'bg-gray-50 text-slate-700'
                  }`}>
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
            2. Filtrează Datele
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
                    <label className="block text-xs text-gray-500 mb-1.5">De la</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                      <DatePicker
                        date={startDate}
                        onSelect={setStartDate}
                        placeholder="Data de început"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Până la</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                      <DatePicker
                        date={endDate}
                        onSelect={setEndDate}
                        placeholder="Data de sfârșit"
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
                    Status Sentință
                  </label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-full h-10 bg-white border border-gray-200 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-slate-500 focus:border-slate-500">
                      <SelectValue placeholder="Toate statusurile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toate statusurile</SelectItem>
                      <SelectItem value="active">Activă</SelectItem>
                      <SelectItem value="suspended">Suspendată</SelectItem>
                      <SelectItem value="completed">Finalizată</SelectItem>
                      <SelectItem value="conditionally_released">Liberare condiționată</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Tip Fracție
                  </label>
                  <Select value={fractionType} onValueChange={setFractionType}>
                    <SelectTrigger className="w-full h-10 bg-white border border-gray-200 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-slate-500 focus:border-slate-500">
                      <SelectValue placeholder="Toate fracțiile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toate fracțiile</SelectItem>
                      <SelectItem value="1/3">1/3 - Liberare condiționată</SelectItem>
                      <SelectItem value="1/2">1/2 - Schimbare regim</SelectItem>
                      <SelectItem value="2/3">2/3 - Liberare (infracțiuni grave)</SelectItem>
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
            3. Exportă Raportul
          </h2>

          <div className="bg-slate-50 border border-gray-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Report Summary */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border border-gray-200 rounded-md flex items-center justify-center">
                  {selectedReportInfo && <selectedReportInfo.icon className="h-5 w-5 text-slate-600" strokeWidth={1.5} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedReportInfo?.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {startDate || endDate
                      ? `Filtrat pe interval de date`
                      : 'Toate înregistrările'}
                  </p>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportPdf}
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
                  onClick={handleExportXlsx}
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
                <span>Raportul va fi descărcat automat în formatul selectat</span>
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
            Selectează tipul raportului și parametrii, apoi apasă pe butonul de export pentru a genera documentul.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
