'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import { Plus, Scale, FileSpreadsheet, FileText, Calendar, User, Users } from 'lucide-react'
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
  commissionsApi,
  CommissionSessionListItem,
  CommissionMonthlyReport,
  CommissionQuarterlyReport,
  MONTH_NAMES_RO,
  QUARTERS,
} from '@/lib/api'

function CommissionsContent() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3))
  const [activeTab, setActiveTab] = useState<string>('sedinte')
  const [sessions, setSessions] = useState<CommissionSessionListItem[]>([])
  const [monthlyData, setMonthlyData] = useState<CommissionMonthlyReport | null>(null)
  const [quarterlyData, setQuarterlyData] = useState<CommissionQuarterlyReport | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    setLoading(true)

    if (activeTab === 'sedinte') {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      })
      commissionsApi.list(token, params)
        .then(data => setSessions(data.results))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else if (activeTab === 'lunar') {
      commissionsApi.monthlyReport(token, year, month)
        .then(setMonthlyData)
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      commissionsApi.quarterlyReport(token, year, quarter)
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
      ? commissionsApi.exportXlsx(params)
      : commissionsApi.exportPdf(params)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `comisie_${year}_${activeTab === 'trimestrial' ? 'T' + quarter : month}.${fmt}`
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

  const renderReportTable = (articles: CommissionMonthlyReport['articles'], totals: CommissionMonthlyReport['totals']) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[50px] text-center">Nr.</TableHead>
              <TableHead>Articol</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Realizat</TableHead>
              <TableHead className="text-center">Nerealizat</TableHead>
              <TableHead className="text-center">Nerealizat (ind.)</TableHead>
              <TableHead className="text-center">Pozitiv</TableHead>
              <TableHead className="text-center">Negativ</TableHead>
              <TableHead className="text-center">Admis</TableHead>
              <TableHead className="text-center">Respins</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((row, idx) => (
              <TableRow key={row.article} className="hover:bg-slate-50/50">
                <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                <TableCell className="font-medium">{row.article_display}</TableCell>
                <TableCell className="text-center font-semibold">{row.total}</TableCell>
                <TableCell className="text-center">
                  <span className="text-green-600 font-medium">{row.realizat}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-red-500 font-medium">{row.nerealizat}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-orange-500 font-medium">{row.nerealizat_independent}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-blue-600 font-medium">{row.pozitiv}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-red-500 font-medium">{row.negativ}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-green-600 font-medium">{row.admis}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-red-500 font-medium">{row.respins}</span>
                </TableCell>
              </TableRow>
            ))}
            {/* Totals row */}
            <TableRow className="bg-slate-100 border-t-2 border-slate-300">
              <TableCell></TableCell>
              <TableCell className="font-bold text-slate-900">TOTAL</TableCell>
              <TableCell className="text-center font-bold text-slate-900">{totals.total}</TableCell>
              <TableCell className="text-center font-bold text-green-600">{totals.realizat}</TableCell>
              <TableCell className="text-center font-bold text-red-500">{totals.nerealizat}</TableCell>
              <TableCell className="text-center font-bold text-orange-500">{totals.nerealizat_independent}</TableCell>
              <TableCell className="text-center font-bold text-blue-600">{totals.pozitiv}</TableCell>
              <TableCell className="text-center font-bold text-red-500">{totals.negativ}</TableCell>
              <TableCell className="text-center font-bold text-green-600">{totals.admis}</TableCell>
              <TableCell className="text-center font-bold text-red-500">{totals.respins}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comisia Penitenciara</h1>
          <p className="text-sm text-slate-500 mt-1">Evaluarea condamnatilor in cadrul comisiei</p>
        </div>
        <Link href="/comisia/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Adauga sedinta
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

            {activeTab !== 'sedinte' && (
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
          <TabsTrigger value="sedinte">Sedinte</TabsTrigger>
          <TabsTrigger value="lunar">Raport Lunar</TabsTrigger>
          <TabsTrigger value="trimestrial">Raport Trimestrial</TabsTrigger>
        </TabsList>

        {/* Tab: Sedinte */}
        <TabsContent value="sedinte" className="mt-4">
          {loading ? (
            <Skeleton className="h-96" />
          ) : sessions.length > 0 ? (
            <div className="grid gap-3">
              {sessions.map((s) => (
                <Link key={s.id} href={`/comisia/${s.id}`}>
                  <Card className="hover:shadow-md transition-all cursor-pointer border-slate-100 hover:border-slate-300">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-50">
                            <Scale className="h-4.5 w-4.5 text-slate-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {formatDate(s.session_date)}
                              </span>
                              {s.session_number && (
                                <Badge variant="outline" className="text-[10px]">
                                  {s.session_number}
                                </Badge>
                              )}
                              {s.description && (
                                <span className="text-sm text-slate-500">
                                  &mdash; {s.description}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {s.evaluations_count} persoane evaluate
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {s.created_by_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(s.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-xs text-slate-400 uppercase tracking-wide">Total</div>
                            <div className="text-lg font-bold text-slate-700 tabular-nums">{s.total_articles}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400 uppercase tracking-wide">Art.91</div>
                            <div className="text-lg font-bold text-blue-600 tabular-nums">{s.art91_count}</div>
                            <div className="flex items-center justify-end gap-2 mt-0.5">
                              <span className="text-[10px] text-green-600">{s.art91_admis} adm.</span>
                              <span className="text-[10px] text-red-500">{s.art91_respins} resp.</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400 uppercase tracking-wide">Art.92</div>
                            <div className="text-lg font-bold text-green-600 tabular-nums">{s.art92_count}</div>
                            <div className="flex items-center justify-end gap-2 mt-0.5">
                              <span className="text-[10px] text-green-600">{s.art92_admis} adm.</span>
                              <span className="text-[10px] text-red-500">{s.art92_respins} resp.</span>
                            </div>
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
                <Scale className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">
                  Nu exista sedinte pentru {MONTH_NAMES_RO[month]} {year}
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">Adaugati o sedinta noua a comisiei.</p>
                <Link href="/comisia/new">
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adauga sedinta
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
          ) : monthlyData && monthlyData.articles.some(a => a.total > 0) ? (
            renderReportTable(monthlyData.articles, monthlyData.totals)
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Scale className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">Nu exista date pentru {MONTH_NAMES_RO[month]} {year}</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">Adaugati sedinte de comisie pentru aceasta luna.</p>
                <Link href="/comisia/new">
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adauga sedinta
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
          ) : quarterlyData && quarterlyData.articles.some(a => a.total > 0) ? (
            renderReportTable(quarterlyData.articles, quarterlyData.totals)
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Scale className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">
                  Nu exista date pentru {QUARTERS.find(q => q.value === quarter)?.label} {year}
                </h3>
                <p className="text-sm text-slate-500 mt-1">Adaugati sedinte de comisie pentru lunile din acest trimestru.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function CommissionsPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>}>
      <CommissionsContent />
    </Suspense>
  )
}
