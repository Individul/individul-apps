'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Clock, AlertTriangle, AlertCircle, CheckCircle, Plus, FileText, UserCheck } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { personsApi, alertsApi, DashboardStats, AlertDashboard } from '@/lib/api'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [alertSummary, setAlertSummary] = useState<AlertDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    Promise.all([
      personsApi.stats(token),
      alertsApi.dashboard(token)
    ])
      .then(([statsData, alertData]) => {
        setStats(statsData)
        setAlertSummary(alertData)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [router])

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            <span className="text-sm">Se încarcă...</span>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Panou Principal</h1>
            <p className="text-sm text-slate-500 mt-0.5">Monitorizarea termenelor de executare</p>
          </div>
          <Link
            href="/persons/new"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" strokeWidth={2} />
            Adaugă persoană
          </Link>
        </div>

        {/* Stats Cards - Refined */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {/* Total Persons */}
          <Link
            href="/persons?tab=all"
            className="block bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Total Persoane
                </p>
                <p className="text-3xl font-semibold text-slate-800 mt-2 tabular-nums">
                  {stats?.total_persons || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {stats?.persons_with_active_sentences || 0} cu sentințe active
                </p>
              </div>
              <Users className="h-5 w-5 text-slate-300 opacity-60" strokeWidth={1.5} />
            </div>
          </Link>

          {/* Released Persons */}
          <Link
            href="/persons?tab=archive"
            className="block bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Liberate
                </p>
                <p className="text-3xl font-semibold text-emerald-600 mt-2 tabular-nums">
                  {stats?.released_persons || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Persoane marcate eliberate
                </p>
              </div>
              <UserCheck className="h-5 w-5 text-emerald-300 opacity-60" strokeWidth={1.5} />
            </div>
          </Link>

          {/* Overdue */}
          <Link
            href="/alerts?tab=overdue"
            className="block bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Termene Depășite
                </p>
                <p className="text-3xl font-semibold text-red-600 mt-2 tabular-nums">
                  {alertSummary?.overdue || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Necesită atenție imediată
                </p>
              </div>
              <AlertTriangle className="h-5 w-5 text-red-300 opacity-60" strokeWidth={1.5} />
            </div>
          </Link>

          {/* Imminent */}
          <Link
            href="/alerts?tab=imminent"
            className="block bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Termene Iminente
                </p>
                <p className="text-3xl font-semibold text-amber-600 mt-2 tabular-nums">
                  {alertSummary?.imminent || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  În următoarele 30 de zile
                </p>
              </div>
              <AlertCircle className="h-5 w-5 text-amber-300 opacity-60" strokeWidth={1.5} />
            </div>
          </Link>

          {/* Fulfilled */}
          <Link
            href="/alerts?tab=all"
            className="block bg-white rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Îndeplinite
                </p>
                <p className="text-3xl font-semibold text-emerald-600 mt-2 tabular-nums">
                  {alertSummary?.fulfilled || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Fracții completate
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-emerald-300 opacity-60" strokeWidth={1.5} />
            </div>
          </Link>
        </div>

        {/* Alert Summary - No borders between rows */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5">
            <h2 className="text-sm font-semibold text-slate-800">Sumar Alerte</h2>
            <p className="text-xs text-slate-500 mt-0.5">Distribuția termenelor pe categorii</p>
          </div>
          <div className="px-2 pb-2">
            {/* Overdue Row */}
            <div className="flex items-center justify-between px-4 py-3 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-50 text-red-700">
                  Depășite
                </span>
                <span className="text-sm text-slate-600">Termene care au trecut de data calculată</span>
              </div>
              <span className="text-sm font-semibold text-slate-800 tabular-nums">{alertSummary?.overdue || 0}</span>
            </div>

            {/* Imminent Row */}
            <div className="flex items-center justify-between px-4 py-3 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">
                  ≤ 30 Zile
                </span>
                <span className="text-sm text-slate-600">Termene iminente</span>
              </div>
              <span className="text-sm font-semibold text-slate-800 tabular-nums">{alertSummary?.imminent || 0}</span>
            </div>

            {/* Upcoming Row */}
            <div className="flex items-center justify-between px-4 py-3 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700">
                  30-90 Zile
                </span>
                <span className="text-sm text-slate-600">Termene în curând</span>
              </div>
              <span className="text-sm font-semibold text-slate-800 tabular-nums">{alertSummary?.upcoming || 0}</span>
            </div>

            {/* Fulfilled Row */}
            <div className="flex items-center justify-between px-4 py-3 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                  Îndeplinite
                </span>
                <span className="text-sm text-slate-600">Fracții completate</span>
              </div>
              <span className="text-sm font-semibold text-slate-800 tabular-nums">{alertSummary?.fulfilled || 0}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions - Card-like interactive buttons */}
        <div>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Acțiuni Rapide</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/persons"
              className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm hover:shadow-md border border-transparent transition-all group"
            >
              <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                <Users className="h-5 w-5 text-slate-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Persoane</p>
                <p className="text-xs text-slate-500">Vezi toate persoanele</p>
              </div>
            </Link>

            <Link
              href="/alerts"
              className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm hover:shadow-md border border-transparent transition-all group"
            >
              <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                <Clock className="h-5 w-5 text-slate-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Alerte</p>
                <p className="text-xs text-slate-500">Vezi toate alertele</p>
              </div>
            </Link>

            <Link
              href="/reports"
              className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm hover:shadow-md border border-transparent transition-all group"
            >
              <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                <FileText className="h-5 w-5 text-slate-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Rapoarte</p>
                <p className="text-xs text-slate-500">Generează raport</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
