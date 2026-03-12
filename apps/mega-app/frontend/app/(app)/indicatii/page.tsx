'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Indicatie, TaskUser, indicatiiApi, tasksApi } from '@/lib/api'
import { useUserRole } from '@/lib/use-user-role'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Plus,
  Loader2,
  List,
  LayoutGrid,
  Search,
  CalendarClock,
  User,
} from 'lucide-react'

type ViewMode = 'list' | 'kanban'

function getCurrentUserId(): number | null {
  try {
    const token = localStorage.getItem('access_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.user_id ?? null
  } catch {
    return null
  }
}

function PrioritateBadge({ prioritate }: { prioritate: string }) {
  switch (prioritate) {
    case 'URGENT':
      return <Badge className="bg-red-100 text-red-700 border-transparent">Urgent</Badge>
    case 'NORMAL':
      return <Badge className="bg-blue-100 text-blue-700 border-transparent">Normal</Badge>
    case 'SCAZUT':
      return <Badge className="bg-gray-100 text-gray-600 border-transparent">Scazut</Badge>
    default:
      return <Badge variant="secondary">{prioritate}</Badge>
  }
}

function StatusIndicatieBadge({ status }: { status: string }) {
  switch (status) {
    case 'NOU':
      return <Badge className="bg-amber-100 text-amber-700 border-transparent">Nou</Badge>
    case 'IN_LUCRU':
      return <Badge className="bg-blue-100 text-blue-700 border-transparent">In lucru</Badge>
    case 'INDEPLINIT':
      return <Badge className="bg-green-100 text-green-700 border-transparent">Indeplinit</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getOverallStatus(indicatie: Indicatie): 'NOU' | 'IN_LUCRU' | 'INDEPLINIT' {
  const dest = indicatie.destinatari
  if (!dest || dest.length === 0) return 'NOU'
  if (dest.every(d => d.status === 'INDEPLINIT')) return 'INDEPLINIT'
  if (dest.some(d => d.status === 'IN_LUCRU' || d.status === 'INDEPLINIT')) return 'IN_LUCRU'
  return 'NOU'
}

function getUserStatusForIndicatie(indicatie: Indicatie, userId: number | null): 'NOU' | 'IN_LUCRU' | 'INDEPLINIT' {
  if (!userId) return getOverallStatus(indicatie)
  const dest = indicatie.destinatari.find(d => d.destinatar === userId)
  if (dest) return dest.status
  // User is creator, show overall status
  return getOverallStatus(indicatie)
}

function IndicatiiContent() {
  const searchParams = useSearchParams()
  const { isViewer } = useUserRole()
  const [indicatii, setIndicatii] = useState<Indicatie[]>([])
  const [users, setUsers] = useState<TaskUser[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [prioritateFilter, setPrioritateFilter] = useState<string>('ALL')
  const [destinatarFilter, setDestinatarFilter] = useState<string>('ALL')

  const currentUserId = useMemo(() => getCurrentUserId(), [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) return
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (prioritateFilter !== 'ALL') params.prioritate = prioritateFilter
      if (destinatarFilter !== 'ALL') params.destinatar = destinatarFilter
      const data = await indicatiiApi.list(token, Object.keys(params).length > 0 ? params : undefined)
      setIndicatii(data)
    } catch (error) {
      console.error('Failed to load indicatii:', error)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, prioritateFilter, destinatarFilter])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    tasksApi.users(token).then(setUsers).catch(console.error)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const kanbanColumns = useMemo(() => {
    const cols: Record<string, Indicatie[]> = { NOU: [], IN_LUCRU: [], INDEPLINIT: [] }
    indicatii.forEach(ind => {
      const status = getUserStatusForIndicatie(ind, currentUserId)
      if (cols[status]) {
        cols[status].push(ind)
      }
    })
    return cols
  }, [indicatii, currentUserId])

  function isOverdue(termenLimita: string | null): boolean {
    if (!termenLimita) return false
    return new Date(termenLimita) < new Date()
  }

  function renderIndicatieCard(indicatie: Indicatie) {
    const overallStatus = getOverallStatus(indicatie)
    return (
      <Link key={indicatie.id} href={`/indicatii/${indicatie.id}`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-medium text-sm line-clamp-2">{indicatie.titlu}</h3>
              <PrioritateBadge prioritate={indicatie.prioritate} />
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {indicatie.destinatari.map(d => (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                >
                  <User className="h-3 w-3" />
                  {d.destinatar_details.full_name}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {indicatie.termen_limita && (
                  <span className={cn('flex items-center gap-1', isOverdue(indicatie.termen_limita) && overallStatus !== 'INDEPLINIT' ? 'text-red-600 font-medium' : '')}>
                    <CalendarClock className="h-3 w-3" />
                    {formatDate(indicatie.termen_limita)}
                  </span>
                )}
              </div>
              <StatusIndicatieBadge status={overallStatus} />
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  function renderListRow(indicatie: Indicatie) {
    const overallStatus = getOverallStatus(indicatie)
    return (
      <Link key={indicatie.id} href={`/indicatii/${indicatie.id}`}>
        <div className="flex items-center gap-4 px-4 py-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{indicatie.titlu}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              de {indicatie.created_by_details.full_name} - {formatDate(indicatie.created_at)}
            </p>
          </div>
          <PrioritateBadge prioritate={indicatie.prioritate} />
          <div className="flex items-center gap-1 min-w-[120px]">
            {indicatie.destinatari.slice(0, 2).map(d => (
              <span
                key={d.id}
                className="inline-flex items-center text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                title={d.destinatar_details.full_name}
              >
                {d.destinatar_details.first_name?.[0]}{d.destinatar_details.last_name?.[0]}
              </span>
            ))}
            {indicatie.destinatari.length > 2 && (
              <span className="text-xs text-muted-foreground">+{indicatie.destinatari.length - 2}</span>
            )}
          </div>
          <div className="min-w-[90px] text-right">
            {indicatie.termen_limita ? (
              <span className={cn('text-xs', isOverdue(indicatie.termen_limita) && overallStatus !== 'INDEPLINIT' ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                {formatDate(indicatie.termen_limita)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </div>
          <div className="min-w-[90px]">
            <StatusIndicatieBadge status={overallStatus} />
          </div>
        </div>
      </Link>
    )
  }

  const kanbanColumnConfig = [
    { key: 'NOU', label: 'Nou', color: 'border-amber-300 bg-amber-50' },
    { key: 'IN_LUCRU', label: 'In lucru', color: 'border-blue-300 bg-blue-50' },
    { key: 'INDEPLINIT', label: 'Indeplinit', color: 'border-green-300 bg-green-50' },
  ]

  return (
    <div className="flex-1 flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Indicatii</h1>
        <div className="flex items-center gap-2">
          <Link href="/indicatii/nou">
            <Button disabled={isViewer}>
              <Plus className="h-4 w-4 mr-2" />
              Indicatie noua
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cauta indicatii..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toate</SelectItem>
            <SelectItem value="NOU">Nou</SelectItem>
            <SelectItem value="IN_LUCRU">In lucru</SelectItem>
            <SelectItem value="INDEPLINIT">Indeplinit</SelectItem>
          </SelectContent>
        </Select>

        <Select value={prioritateFilter} onValueChange={setPrioritateFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Prioritate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toate</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="SCAZUT">Scazut</SelectItem>
          </SelectContent>
        </Select>

        <Select value={destinatarFilter} onValueChange={setDestinatarFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Destinatar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toti</SelectItem>
            {users.map(u => (
              <SelectItem key={u.id} value={u.id.toString()}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-r-none"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            className="rounded-l-none"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : indicatii.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p>Nu s-au gasit indicatii</p>
          {!isViewer && (
            <Link href="/indicatii/nou">
              <Button variant="outline" className="mt-4">
                Creeaza prima indicatie
              </Button>
            </Link>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2 overflow-y-auto">
          {indicatii.map(ind => renderListRow(ind))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 overflow-y-auto">
          {kanbanColumnConfig.map(col => (
            <div key={col.key} className="flex flex-col">
              <div className={cn('px-3 py-2 rounded-t-lg border-t-2 font-medium text-sm mb-2', col.color)}>
                {col.label}
                <span className="ml-2 text-muted-foreground">({kanbanColumns[col.key]?.length || 0})</span>
              </div>
              <div className="space-y-2 flex-1">
                {(kanbanColumns[col.key] || []).map(ind => renderIndicatieCard(ind))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function IndicatiiPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    }>
      <IndicatiiContent />
    </Suspense>
  )
}
