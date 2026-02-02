'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { AppLayout } from '@/components/layout/app-layout'
import { petitionsApi, Petition, PaginatedResponse } from '@/lib/api'
import { formatDate } from '@/lib/utils'

const statusOptions = [
  { value: 'all', label: 'Toate statusurile' },
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

export default function PetitionsPage() {
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
      router.push('/petitii/login')
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
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Petiții</h1>
          <Link href="/petitii/petitions/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Petiție nouă
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtre și căutare</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Căutare după nume petiționar, deținut..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-48">
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
              <Select value={dueFilter} onValueChange={setDueFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Termen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate</SelectItem>
                  <SelectItem value="due_soon">Scadente în curând</SelectItem>
                  <SelectItem value="overdue">Termen depășit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleExportXlsx}>
                <Download className="h-4 w-4 mr-2" />
                Export XLSX
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr. Înreg.</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Petiționar</TableHead>
                    <TableHead>Obiect</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Termen</TableHead>
                    <TableHead className="text-right">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.results.map((petition) => (
                    <TableRow key={petition.id}>
                      <TableCell className="font-medium">
                        {petition.registration_number}
                      </TableCell>
                      <TableCell>{formatDate(petition.registration_date)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{petition.petitioner_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {petition.petitioner_type_display}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{petition.object_type_display}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[petition.status] || 'default'}>
                          {petition.status_display}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {formatDate(petition.response_due_date)}
                          {petition.is_overdue && (
                            <Badge variant="destructive" className="text-xs">
                              Depășit
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
                        <Link href={`/petitii/petitions/${petition.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.results || data.results.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nu au fost găsite petiții
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {data && data.count > 20 && (
          <div className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Afișate {data.results.length} din {data.count} petiții
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
