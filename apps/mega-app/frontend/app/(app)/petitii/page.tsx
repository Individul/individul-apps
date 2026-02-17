'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { petitionsApi, Petition, PaginatedResponse } from '@/lib/api'
import { formatDate } from '@/lib/utils'

const statusOptions = [
  { value: 'all', label: 'Toate statusurile' },
  { value: 'inregistrata', label: 'Inregistrata' },
  { value: 'in_examinare', label: 'In examinare' },
  { value: 'solutionata', label: 'Solutionata' },
  { value: 'respinsa', label: 'Respinsa' },
  { value: 'redirectionata', label: 'Redirectionata' },
]

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  inregistrata: 'default',
  in_examinare: 'warning',
  solutionata: 'success',
  respinsa: 'destructive',
  redirectionata: 'secondary',
}

function PetitionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<PaginatedResponse<Petition> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')
  const [dueFilter, setDueFilter] = useState(searchParams.get('due_filter') || '')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status && status !== 'all') params.set('status', status)
    if (dueFilter) params.set('due_filter', dueFilter)

    setLoading(true)
    petitionsApi.list(token, params)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router, search, status, dueFilter])

  const handleExportXlsx = () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (dueFilter) params.set('due_filter', dueFilter)
    window.open(petitionsApi.exportXlsx(token, params), '_blank')
  }

  const handleExportPdf = () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (dueFilter) params.set('due_filter', dueFilter)
    window.open(petitionsApi.exportPdf(token, params), '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Petitii</h1>
        <Link href="/petitii/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Petitie noua
          </Button>
        </Link>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="text-base font-semibold text-slate-800">Filtre si cautare</h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cautare dupa nume petitionar, detinut..."
                className="pl-9 focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="bg-gray-100 rounded-lg p-1 flex">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full sm:w-44 border-0 bg-white shadow-sm focus:ring-1 focus:ring-slate-500">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-gray-100 rounded-lg p-1 flex">
                <Select value={dueFilter} onValueChange={setDueFilter}>
                  <SelectTrigger className="w-full sm:w-44 border-0 bg-white shadow-sm focus:ring-1 focus:ring-slate-500">
                    <SelectValue placeholder="Termen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate</SelectItem>
                    <SelectItem value="due_soon">Scadente in curand</SelectItem>
                    <SelectItem value="overdue">Termen depasit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={handleExportXlsx} className="hover:bg-slate-50">
              <Download className="h-4 w-4 mr-2" />
              Export XLSX
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="hover:bg-slate-50">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-gray-100">
                  <TableHead>Nr. Inreg.</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Petitionar</TableHead>
                  <TableHead>Obiect</TableHead>
                  <TableHead>Status</TableHead>
                  {status === 'solutionata' && <TableHead>Data solutionarii</TableHead>}
                  <TableHead>Termen</TableHead>
                  <TableHead className="text-right">Actiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.results.map((petition) => (
                  <TableRow key={petition.id} className="border-b border-gray-50 hover:bg-[#F8FAFC]">
                    <TableCell className="font-medium text-slate-800 tabular-nums">
                      {petition.registration_number}
                    </TableCell>
                    <TableCell className="text-slate-600 tabular-nums">{formatDate(petition.registration_date)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-800">{petition.petitioner_name}</div>
                        <div className="text-xs text-slate-500">
                          {petition.petitioner_type_display}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{petition.object_type_display}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[petition.status] || 'default'}>
                        {petition.status_display}
                      </Badge>
                    </TableCell>
                    {status === 'solutionata' && (
                      <TableCell className="text-slate-600 tabular-nums">
                        {petition.resolution_date ? formatDate(petition.resolution_date) : '-'}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 tabular-nums">{formatDate(petition.response_due_date)}</span>
                        {petition.is_overdue && (
                          <Badge variant="destructive" className="text-xs">
                            Depasit
                          </Badge>
                        )}
                        {petition.is_due_soon && !petition.is_overdue && (
                          <Badge variant="warning" className="text-xs">
                            {petition.days_until_due} zile
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/petitii/${petition.id}`}>
                        <Button variant="ghost" size="sm" className="hover:bg-slate-100">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.results || data.results.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={status === 'solutionata' ? 8 : 7} className="text-center py-8 text-slate-500">
                      Nu au fost gasite petitii
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {data && data.count > 20 && (
        <div className="flex justify-center">
          <p className="text-sm text-slate-500">
            Afisate {data.results.length} din {data.count} petitii
          </p>
        </div>
      )}
    </div>
  )
}

export default function PetitionsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    }>
      <PetitionsContent />
    </Suspense>
  )
}
