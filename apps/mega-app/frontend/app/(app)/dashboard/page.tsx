'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ListTodo, FileText, Users, AlertTriangle,
  ClipboardList, Loader, CheckCheck, LayoutList,
  Inbox, CheckCircle2, Timer, AlertCircle,
  UserCheck, Hourglass, UserX, UsersRound,
  ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown,
  Scale, ClipboardCheck, Activity,
  Bug, Loader2, CheckCircle, XCircle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { petitionsApi, personsApi, alertsApi, notificationsApi, tasksApi, transfersApi, commissionsApi, trackerApi, PetitionStats, DashboardStats, AlertDashboard, TransferStats, CommissionStats, TrackerStats } from '@/lib/api'

interface KpiCardProps {
  href: string
  label: string
  value: number
  description: string
  icon: React.ReactNode
  color?: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'orange'
}

const colorMap = {
  default: {
    border: 'border-gray-100 hover:border-slate-300',
    value: 'text-slate-800',
    iconBg: 'bg-slate-50',
  },
  blue: {
    border: 'border-blue-100 hover:border-blue-300',
    value: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  green: {
    border: 'border-green-100 hover:border-green-300',
    value: 'text-green-600',
    iconBg: 'bg-green-50',
  },
  yellow: {
    border: 'border-yellow-100 hover:border-yellow-300',
    value: 'text-yellow-600',
    iconBg: 'bg-yellow-50',
  },
  red: {
    border: 'border-red-100 hover:border-red-300',
    value: 'text-red-500',
    iconBg: 'bg-red-50',
  },
  orange: {
    border: 'border-orange-100 hover:border-orange-300',
    value: 'text-orange-600',
    iconBg: 'bg-orange-50',
  },
}

function KpiCard({ href, label, value, description, icon, color = 'default' }: KpiCardProps) {
  const c = colorMap[color]
  return (
    <Link href={href}>
      <div className={`bg-white rounded-xl p-5 shadow-sm border ${c.border} hover:shadow-md transition-all cursor-pointer h-full`}>
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-tight">
            {label}
          </span>
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${c.iconBg} flex-shrink-0`}>
            {icon}
          </div>
        </div>
        <div className={`text-3xl font-bold tabular-nums ${c.value}`}>{value}</div>
        <p className="text-[11px] text-slate-400 mt-1.5">{description}</p>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [petitionStats, setPetitionStats] = useState<PetitionStats | null>(null)
  const [personStats, setPersonStats] = useState<DashboardStats | null>(null)
  const [alertSummary, setAlertSummary] = useState<AlertDashboard | null>(null)
  const [taskCounts, setTaskCounts] = useState({ total: 0, todo: 0, in_progress: 0, done: 0 })
  const [transferStats, setTransferStats] = useState<TransferStats | null>(null)
  const [commissionStats, setCommissionStats] = useState<CommissionStats | null>(null)
  const [trackerStats, setTrackerStats] = useState<TrackerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    notificationsApi.generate(token).catch(() => {})
    alertsApi.generate(token).catch(() => {})

    Promise.all([
      petitionsApi.stats(token).catch(() => null),
      personsApi.stats(token).catch(() => null),
      alertsApi.dashboard(token).catch(() => null),
      tasksApi.list(token).catch(() => []),
      transfersApi.stats(token).catch(() => null),
      commissionsApi.stats(token).catch(() => null),
      trackerApi.stats(token).catch(() => null),
    ]).then(([pStats, perStats, alerts, tasks, tStats, cStats, trStats]) => {
      if (pStats) setPetitionStats(pStats)
      if (perStats) setPersonStats(perStats)
      if (alerts) setAlertSummary(alerts)
      if (tStats) setTransferStats(tStats)
      if (cStats) setCommissionStats(cStats as CommissionStats)
      if (trStats) setTrackerStats(trStats as TrackerStats)
      if (Array.isArray(tasks)) {
        setTaskCounts({
          total: tasks.length,
          todo: tasks.filter((t: any) => t.status === 'TODO').length,
          in_progress: tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
          done: tasks.filter((t: any) => t.status === 'DONE').length,
        })
      }
    }).finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(16)].map((_, i) => <Skeleton key={i} className="h-[130px] rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>

      {/* Dosare defecte */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ListTodo className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-700">Dosare defecte</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            href="/tasks"
            label="Total"
            value={taskCounts.total}
            description="Toate sarcinile"
            icon={<LayoutList className="h-4.5 w-4.5 text-slate-500" strokeWidth={1.5} />}
          />
          <KpiCard
            href="/tasks?status=TODO"
            label="De făcut"
            value={taskCounts.todo}
            description="Sarcini noi de realizat"
            icon={<ClipboardList className="h-4.5 w-4.5 text-blue-500" strokeWidth={1.5} />}
            color="blue"
          />
          <KpiCard
            href="/tasks?status=IN_PROGRESS"
            label="În lucru"
            value={taskCounts.in_progress}
            description="Sarcini în desfășurare"
            icon={<Loader className="h-4.5 w-4.5 text-orange-500" strokeWidth={1.5} />}
            color="orange"
          />
          <KpiCard
            href="/tasks?status=DONE"
            label="Finalizate"
            value={taskCounts.done}
            description="Sarcini încheiate"
            icon={<CheckCheck className="h-4.5 w-4.5 text-green-500" strokeWidth={1.5} />}
            color="green"
          />
        </div>
      </section>

      {/* Petitii */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-700">Petiții</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            href="/petitii"
            label="Total"
            value={petitionStats?.total || 0}
            description="Toate petițiile din sistem"
            icon={<Inbox className="h-4.5 w-4.5 text-slate-500" strokeWidth={1.5} />}
          />
          <KpiCard
            href="/petitii?status=solutionata"
            label="Soluționate"
            value={petitionStats?.by_status?.solutionata || 0}
            description="Petiții rezolvate"
            icon={<CheckCircle2 className="h-4.5 w-4.5 text-green-500" strokeWidth={1.5} />}
            color="green"
          />
          <KpiCard
            href="/petitii?due_filter=due_soon"
            label="Scadente"
            value={petitionStats?.due_soon || 0}
            description="Termen în următoarele 3 zile"
            icon={<Timer className="h-4.5 w-4.5 text-yellow-600" strokeWidth={1.5} />}
            color="yellow"
          />
          <KpiCard
            href="/petitii?due_filter=overdue"
            label="Depășite"
            value={petitionStats?.overdue || 0}
            description="Termen depășit"
            icon={<AlertCircle className="h-4.5 w-4.5 text-red-500" strokeWidth={1.5} />}
            color="red"
          />
        </div>
      </section>

      {/* Termene */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-700">Termene</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            href="/termene"
            label="Total persoane"
            value={personStats?.total_persons || 0}
            description="Toate persoanele din sistem"
            icon={<UsersRound className="h-4.5 w-4.5 text-slate-500" strokeWidth={1.5} />}
          />
          <KpiCard
            href="/termene"
            label="Persoane active"
            value={personStats?.persons_with_active_sentences || 0}
            description="Cu sentințe active"
            icon={<UserCheck className="h-4.5 w-4.5 text-blue-500" strokeWidth={1.5} />}
            color="blue"
          />
          <KpiCard
            href="/termene/alerts"
            label="Fracții iminente"
            value={alertSummary?.imminent || 0}
            description="Se apropie de termen"
            icon={<Hourglass className="h-4.5 w-4.5 text-orange-500" strokeWidth={1.5} />}
            color="orange"
          />
          <KpiCard
            href="/termene/alerts"
            label="Fracții depășite"
            value={alertSummary?.overdue || 0}
            description="Necesită atenție imediată"
            icon={<AlertTriangle className="h-4.5 w-4.5 text-red-500" strokeWidth={1.5} />}
            color="red"
          />
        </div>
      </section>

      {/* Transferuri */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-700">Transferuri</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            href="/transferuri"
            label="Veniti luna curenta"
            value={transferStats?.current_month_veniti || 0}
            description="Persoane sosite la P-6"
            icon={<ArrowDownToLine className="h-4.5 w-4.5 text-blue-500" strokeWidth={1.5} />}
            color="blue"
          />
          <KpiCard
            href="/transferuri"
            label="Plecati luna curenta"
            value={transferStats?.current_month_plecati || 0}
            description="Persoane transferate de la P-6"
            icon={<ArrowUpFromLine className="h-4.5 w-4.5 text-orange-500" strokeWidth={1.5} />}
            color="orange"
          />
          <KpiCard
            href="/transferuri"
            label="Sold net"
            value={transferStats?.current_month_net || 0}
            description="Diferenta veniti - plecati"
            icon={(transferStats?.current_month_net || 0) >= 0
              ? <TrendingUp className="h-4.5 w-4.5 text-green-500" strokeWidth={1.5} />
              : <TrendingDown className="h-4.5 w-4.5 text-red-500" strokeWidth={1.5} />
            }
            color={(transferStats?.current_month_net || 0) >= 0 ? 'green' : 'red'}
          />
          <KpiCard
            href="/transferuri"
            label="Total transferuri"
            value={transferStats?.total_transfers || 0}
            description="Transferuri inregistrate"
            icon={<ArrowLeftRight className="h-4.5 w-4.5 text-slate-500" strokeWidth={1.5} />}
          />
        </div>
      </section>

      {/* Comisia Penitenciara */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-700">Comisia Penitenciara</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            href="/comisia"
            label="Total examinări"
            value={commissionStats?.total_examinations || 0}
            description="Examinări luna curentă"
            icon={<ClipboardCheck className="h-4.5 w-4.5 text-slate-500" strokeWidth={1.5} />}
          />
          <Link href="/comisia">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer h-full">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-tight">
                  Examinări Art.91
                </span>
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 flex-shrink-0">
                  <Activity className="h-4.5 w-4.5 text-blue-500" strokeWidth={1.5} />
                </div>
              </div>
              <div className="text-3xl font-bold tabular-nums text-blue-600">{commissionStats?.art91_total || 0}</div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px] text-green-600 font-medium">Admiși: {commissionStats?.art91_admis || 0}</span>
                <span className="text-[11px] text-red-500 font-medium">Respinși: {commissionStats?.art91_respins || 0}</span>
              </div>
            </div>
          </Link>
          <Link href="/comisia">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-green-100 hover:border-green-300 hover:shadow-md transition-all cursor-pointer h-full">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-tight">
                  Examinări Art.92
                </span>
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-50 flex-shrink-0">
                  <Activity className="h-4.5 w-4.5 text-green-500" strokeWidth={1.5} />
                </div>
              </div>
              <div className="text-3xl font-bold tabular-nums text-green-600">{commissionStats?.art92_total || 0}</div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px] text-green-600 font-medium">Admiși: {commissionStats?.art92_admis || 0}</span>
                <span className="text-[11px] text-red-500 font-medium">Respinși: {commissionStats?.art92_respins || 0}</span>
              </div>
            </div>
          </Link>
          <KpiCard
            href="/comisia"
            label="Total ședințe"
            value={commissionStats?.total_sessions || 0}
            description="Ședințe comisie luna curentă"
            icon={<Scale className="h-4.5 w-4.5 text-orange-500" strokeWidth={1.5} />}
            color="orange"
          />
        </div>
      </section>

      {/* Tracker SIA */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bug className="h-5 w-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-700">Tracker SIA</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            href="/tracker"
            label="Total"
            value={trackerStats?.total || 0}
            description="Toate problemele raportate"
            icon={<Bug className="h-4.5 w-4.5 text-slate-500" strokeWidth={1.5} />}
          />
          <KpiCard
            href="/tracker?status=NOU"
            label="Noi"
            value={trackerStats?.by_status?.NOU || 0}
            description="Probleme neraportate"
            icon={<Loader2 className="h-4.5 w-4.5 text-blue-500" strokeWidth={1.5} />}
            color="blue"
          />
          <KpiCard
            href="/tracker?status=IN_LUCRU"
            label="În lucru"
            value={trackerStats?.by_status?.IN_LUCRU || 0}
            description="Probleme în curs de rezolvare"
            icon={<Loader className="h-4.5 w-4.5 text-orange-500" strokeWidth={1.5} />}
            color="orange"
          />
          <KpiCard
            href="/tracker?status=IMPLEMENTAT"
            label="Implementate"
            value={trackerStats?.by_status?.IMPLEMENTAT || 0}
            description="Probleme rezolvate"
            icon={<CheckCircle className="h-4.5 w-4.5 text-green-500" strokeWidth={1.5} />}
            color="green"
          />
        </div>
      </section>
    </div>
  )
}
