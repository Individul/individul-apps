'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import { Plus, ArrowLeftRight, FileSpreadsheet, FileText, Calendar, User, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  transfersApi,
  TransferListItem,
  MonthlyReportResponse,
  QuarterlyReportResponse,
  MONTH_NAMES_RO,
  QUARTERS,
} from '@/lib/api'

function TransfersContent() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3))
  const [activeTab, setActiveTab] = useState<string>('transferuri')
  const [transfers, setTransfers] = useState<TransferListItem[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyReportResponse | null>(null)
  const [quarterlyData, setQuarterlyData] = useState<QuarterlyReportResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    setLoading(true)

    if (activeTab === 'transferuri') {
      // Load individual transfers for selected month
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      })
      transfersApi.list(token, params)
        .then(data => setTransfers(data.results))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else if (activeTab === 'lunar') {
      transfersApi.monthlyReport(token, year, month)
        .then(setMonthlyData)
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      transfersApi.quarterlyReport(token, year, quarter)
        .then(setQuarterlyData)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [router, year, month, quarter, activeTab])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExport = (fmt: 'xlsx' | 'pdf') => {
    const params = new URLSearchParams({ year: String(year) })
    if (activeTab === 'trimestrial') {
      params.set('quarter', String(quarter))
    } else {
      params.set('month', String(month))
    }
    const token = localStorage.getItem('access_token')
    const url = fmt === 'xlsx'
      ? transfersApi.exportXlsx(params)
      : transfersApi.exportPdf(params)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `transferuri_${year}_${activeTab === 'trimestrial' ? 'T' + quarter : month}.${fmt}`
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - i)

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy', { locale: ro })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transferuri</h1>
          <p className="text-sm text-slate-500 mt-1">Gestionarea transferurilor de condamnati</p>
        </div>
        <Link href="/transferuri/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Adauga transfer
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">An</label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[120px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeTab === 'trimestrial' ? (
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Trimestru</label>
                <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
                  <SelectTrigger className="w-[220px] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map(q => (
                      <SelectItem key={q.value} value={String(q.value)}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Luna</label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-[180px] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES_RO.slice(1).map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeTab !== 'transferuri' && (
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4" />
                  XLSX
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport('pdf')}>
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="transferuri">Transferuri</TabsTrigger>
          <TabsTrigger value="lunar">Raport Lunar</TabsTrigger>
          <TabsTrigger value="trimestrial">Raport Trimestrial</TabsTrigger>
        </TabsList>

        {/* Tab: Transferuri (individual transfers list) */}
        <TabsContent value="transferuri" className="mt-4">
          {loading ? (
            <Skeleton className="h-96" />
          ) : transfers.length > 0 ? (
            <div className="grid gap-3">
              {transfers.map((t) => (
                <Link key={t.id} href={`/transferuri/${t.id}`}>
                  <Card className="hover:shadow-md transition-all cursor-pointer border-slate-100 hover:border-slate-300">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-50">
                            <ArrowLeftRight className="h-4.5 w-4.5 text-slate-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {formatDate(t.transfer_date)}
                              </span>
                              {t.description && (
                                <span className="text-sm text-slate-500">
                                  &mdash; {t.description}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {t.entries_count} penitenciare
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {t.created_by_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(t.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-xs text-slate-400 uppercase tracking-wide">Veniti</div>
                            <div className="text-lg font-bold text-blue-600 tabular-nums">{t.total_veniti}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400 uppercase tracking-wide">Plecati</div>
                            <div className="text-lg font-bold text-orange-600 tabular-nums">{t.total_plecati}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <ArrowLeftRight className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">
                  Nu exista transferuri pentru {MONTH_NAMES_RO[month]} {year}
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">Adaugati un transfer nou pentru aceasta luna.</p>
                <Link href="/transferuri/new">
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adauga transfer
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Raport Lunar */}
        <TabsContent value="lunar" className="mt-4">
          {loading ? (
            <Skeleton className="h-96" />
          ) : monthlyData && monthlyData.entries.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-[50px] text-center">Nr.</TableHead>
                      <TableHead>Penitenciar</TableHead>
                      <TableHead className="text-center">Veniti</TableHead>
                      <TableHead className="text-center">Reintorsi</TableHead>
                      <TableHead className="text-center">Noi</TableHead>
                      <TableHead className="text-center">Plecati</TableHead>
                      <TableHead className="text-center">La izolator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.entries.map((entry, idx) => (
                      <TableRow key={entry.penitentiary} className="hover:bg-slate-50/50">
                        <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="font-medium">
                          {entry.penitentiary_display}
                          {entry.is_isolator && (
                            <Badge variant="outline" className="ml-2 text-[10px] border-amber-300 text-amber-600">
                              Izolator
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-semibold">{entry.veniti}</TableCell>
                        <TableCell className="text-center text-slate-600">{entry.veniti_reintorsi}</TableCell>
                        <TableCell className="text-center text-slate-600">{entry.veniti_noi}</TableCell>
                        <TableCell className="text-center font-semibold">{entry.plecati}</TableCell>
                        <TableCell className="text-center">
                          {entry.is_isolator ? (
                            <span className="font-semibold text-amber-600">{entry.plecati_izolator}</span>
                          ) : (
                            <span className="text-slate-300">&ndash;</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                      <TableCell></TableCell>
                      <TableCell className="font-bold text-slate-900">TOTAL</TableCell>
                      <TableCell className="text-center font-bold text-slate-900">{monthlyData.totals.total_veniti}</TableCell>
                      <TableCell className="text-center font-bold text-slate-700">{monthlyData.totals.total_veniti_reintorsi}</TableCell>
                      <TableCell className="text-center font-bold text-slate-700">{monthlyData.totals.total_veniti_noi}</TableCell>
                      <TableCell className="text-center font-bold text-slate-900">{monthlyData.totals.total_plecati}</TableCell>
                      <TableCell className="text-center font-bold text-amber-600">{monthlyData.totals.total_plecati_izolator}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <ArrowLeftRight className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">Nu exista date pentru {MONTH_NAMES_RO[month]} {year}</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">Adaugati date de transfer pentru aceasta luna.</p>
                <Link href="/transferuri/new">
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adauga transfer
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Raport Trimestrial */}
        <TabsContent value="trimestrial" className="mt-4">
          {loading ? (
            <Skeleton className="h-96" />
          ) : quarterlyData && quarterlyData.entries.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-[50px] text-center">Nr.</TableHead>
                      <TableHead>Penitenciar</TableHead>
                      <TableHead className="text-center">Veniti</TableHead>
                      <TableHead className="text-center">Reintorsi</TableHead>
                      <TableHead className="text-center">Noi</TableHead>
                      <TableHead className="text-center">Plecati</TableHead>
                      <TableHead className="text-center">La izolator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarterlyData.entries.map((entry, idx) => (
                      <TableRow key={entry.penitentiary} className="hover:bg-slate-50/50">
                        <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="font-medium">
                          {entry.penitentiary_display}
                          {entry.is_isolator && (
                            <Badge variant="outline" className="ml-2 text-[10px] border-amber-300 text-amber-600">
                              Izolator
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-semibold">{entry.total_veniti}</TableCell>
                        <TableCell className="text-center text-slate-600">{entry.total_veniti_reintorsi}</TableCell>
                        <TableCell className="text-center text-slate-600">{entry.total_veniti_noi}</TableCell>
                        <TableCell className="text-center font-semibold">{entry.total_plecati}</TableCell>
                        <TableCell className="text-center">
                          {entry.is_isolator ? (
                            <span className="font-semibold text-amber-600">{entry.total_plecati_izolator}</span>
                          ) : (
                            <span className="text-slate-300">&ndash;</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                      <TableCell></TableCell>
                      <TableCell className="font-bold text-slate-900">TOTAL</TableCell>
                      <TableCell className="text-center font-bold text-slate-900">{quarterlyData.totals.total_veniti}</TableCell>
                      <TableCell className="text-center font-bold text-slate-700">{quarterlyData.totals.total_veniti_reintorsi}</TableCell>
                      <TableCell className="text-center font-bold text-slate-700">{quarterlyData.totals.total_veniti_noi}</TableCell>
                      <TableCell className="text-center font-bold text-slate-900">{quarterlyData.totals.total_plecati}</TableCell>
                      <TableCell className="text-center font-bold text-amber-600">{quarterlyData.totals.total_plecati_izolator}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <ArrowLeftRight className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">
                  Nu exista date pentru {QUARTERS.find(q => q.value === quarter)?.label} {year}
                </h3>
                <p className="text-sm text-slate-500 mt-1">Adaugati date de transfer pentru lunile din acest trimestru.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function TransfersPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>}>
      <TransfersContent />
    </Suspense>
  )
}
