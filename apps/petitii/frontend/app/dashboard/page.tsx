'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppLayout } from '@/components/layout/app-layout'
import { petitionsApi, notificationsApi, PetitionStats } from '@/lib/api'

const statusLabels: Record<string, string> = {
  inregistrata: 'Înregistrată',
  in_examinare: 'În examinare',
  solutionata: 'Soluționată',
  respinsa: 'Respinsă',
  redirectionata: 'Redirecționată',
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<PetitionStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    // Generate notifications on dashboard load
    notificationsApi.generate(token).catch(() => {})

    // Fetch stats
    petitionsApi.stats(token)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Panou Principal</h1>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Panou Principal</h1>

        {/* Main stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/petitions">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Total Petiții
                </span>
                <FileText className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
              </div>
              <div className="text-3xl font-semibold text-slate-800 tabular-nums">{stats?.total || 0}</div>
              <p className="text-xs text-slate-500 mt-1">
                Toate petițiile din sistem
              </p>
            </div>
          </Link>

          <Link href="/petitions?due_filter=due_soon">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-yellow-200 hover:border-yellow-300 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Scadente în curând
                </span>
                <Clock className="h-4 w-4 text-yellow-600" strokeWidth={1.5} />
              </div>
              <div className="text-3xl font-semibold text-yellow-600 tabular-nums">
                {stats?.due_soon || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Termen în următoarele 3 zile
              </p>
            </div>
          </Link>

          <Link href="/petitions?due_filter=overdue">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-red-200 hover:border-red-300 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Termen depășit
                </span>
                <AlertTriangle className="h-4 w-4 text-red-500" strokeWidth={1.5} />
              </div>
              <div className="text-3xl font-semibold text-red-500 tabular-nums">
                {stats?.overdue || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Necesită atenție imediată
              </p>
            </div>
          </Link>

          <Link href="/petitions?status=solutionata">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-green-200 hover:border-green-300 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Soluționate
                </span>
                <CheckCircle className="h-4 w-4 text-green-600" strokeWidth={1.5} />
              </div>
              <div className="text-3xl font-semibold text-green-600 tabular-nums">
                {stats?.by_status?.solutionata || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Petiții finalizate
              </p>
            </div>
          </Link>
        </div>

        {/* Status breakdown */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-slate-800">Petiții pe status</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {stats?.by_status && Object.entries(stats.by_status).map(([status, count]) => (
                  <Link
                    key={status}
                    href={`/petitions?status=${status}`}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{statusLabels[status] || status}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 tabular-nums">{count}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
                {(!stats?.by_status || Object.keys(stats.by_status).length === 0) && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Nu există petiții
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-base font-semibold text-slate-800">Acțiuni rapide</h2>
            </div>
            <div className="p-6 space-y-2">
              <Link
                href="/petitions/new"
                className="flex items-center justify-between p-3 rounded-md border border-gray-100 hover:border-slate-300 hover:bg-[#F8FAFC] transition-all"
              >
                <span className="font-medium text-slate-700">Înregistrare petiție nouă</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
              <Link
                href="/petitions?due_filter=overdue"
                className="flex items-center justify-between p-3 rounded-md border border-gray-100 hover:border-slate-300 hover:bg-[#F8FAFC] transition-all"
              >
                <span className="font-medium text-slate-700">Petiții cu termen depășit</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
              <Link
                href="/reports"
                className="flex items-center justify-between p-3 rounded-md border border-gray-100 hover:border-slate-300 hover:bg-[#F8FAFC] transition-all"
              >
                <span className="font-medium text-slate-700">Generare raport</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
