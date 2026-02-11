'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, RefreshCw, AlertTriangle, Clock, X, CheckCircle2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { alertsApi, Alert, PaginatedResponse } from '@/lib/api'
import { formatDate } from '@/lib/utils'

// Tab configuration
const TABS = [
  { id: 'all', label: 'Toate' },
  { id: 'overdue', label: 'Depășite' },
  { id: 'imminent', label: 'Iminente' },
  { id: 'upcoming', label: 'În Curând' },
] as const

type TabId = typeof TABS[number]['id']

// Get border color based on alert type
function getAlertBorderColor(alertType: string): string {
  switch (alertType) {
    case 'overdue':
      return 'border-l-red-500'
    case 'imminent':
      return 'border-l-amber-500'
    case 'upcoming':
      return 'border-l-blue-400'
    default:
      return 'border-l-gray-300'
  }
}

// Get icon background color
function getIconBgColor(alertType: string): string {
  switch (alertType) {
    case 'overdue':
      return 'bg-red-50 text-red-500'
    case 'imminent':
      return 'bg-amber-50 text-amber-500'
    case 'upcoming':
      return 'bg-blue-50 text-blue-500'
    default:
      return 'bg-gray-50 text-gray-500'
  }
}

// Alert Card Component
function AlertCard({
  alert,
  onMarkRead,
  onDismiss
}: {
  alert: Alert
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const borderColor = getAlertBorderColor(alert.alert_type)
  const iconBgColor = getIconBgColor(alert.alert_type)

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${borderColor} p-4 mb-3 transition-all hover:shadow-md ${
        alert.is_read ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Left - Icon */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBgColor}`}>
          {alert.alert_type === 'overdue' ? (
            <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <Clock className="h-5 w-5" strokeWidth={1.5} />
          )}
        </div>

        {/* Middle - Content */}
        <div className="flex-1 min-w-0">
          {/* Person Name */}
          <Link
            href={`/persons/${alert.person}`}
            className="text-sm font-bold text-slate-900 hover:text-slate-700 transition-colors"
          >
            {alert.person_name}
          </Link>

          {/* Message */}
          <p className="text-sm text-slate-600 mt-0.5">
            {alert.message}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-4 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono">
              {alert.fraction_type}
            </span>
            <span className="text-xs text-gray-500">
              Data țintă: <span className="font-medium text-slate-700 tabular-nums">{formatDate(alert.target_date)}</span>
            </span>
            {!alert.is_read && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-900 text-white rounded text-[10px] font-bold">
                NOU
              </span>
            )}
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/persons/${alert.person}`}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="h-3 w-3 mr-1.5" strokeWidth={2} />
            Vezi Dosar
          </Link>
          {!alert.is_read && (
            <button
              onClick={() => onMarkRead(alert.id)}
              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
              title="Marchează ca citit"
            >
              <Check className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
          <button
            onClick={() => onDismiss(alert.id)}
            className="p-1.5 text-gray-400 hover:text-slate-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

// Empty State Component
function EmptyState({ activeTab }: { activeTab: TabId }) {
  const isFiltered = activeTab !== 'all'

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      {/* Large Icon Circle */}
      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 className="h-12 w-12 text-slate-300" strokeWidth={1} />
      </div>

      {/* Message */}
      <h3 className="text-lg font-semibold text-slate-800 mb-2">
        {isFiltered ? 'Nicio alertă în această categorie' : 'Nicio alertă activă'}
      </h3>

      {/* Sub-message */}
      <p className="text-sm text-slate-400 text-center max-w-sm">
        {isFiltered
          ? 'Încercați să schimbați categoria sau verificați mai târziu.'
          : 'Toate termenele sunt sub control. Relaxează-te.'}
      </p>
    </div>
  )
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [activeTab, setActiveTab] = useState<TabId>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const fetchAlerts = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const data: PaginatedResponse<Alert> = await alertsApi.list(token)
      setAlerts(data.results)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    const applyTabFromUrl = () => {
      const tab = new URLSearchParams(window.location.search).get('tab')
      if (tab && TABS.some((item) => item.id === tab)) {
        setActiveTab(tab as TabId)
        return
      }
      setActiveTab('all')
    }

    applyTabFromUrl()
    window.addEventListener('popstate', applyTabFromUrl)
    return () => window.removeEventListener('popstate', applyTabFromUrl)
  }, [])

  // Filter alerts based on active tab
  const filteredAlerts = useMemo(() => {
    if (activeTab === 'all') return alerts
    return alerts.filter(a => a.alert_type === activeTab)
  }, [alerts, activeTab])

  // Count alerts per tab
  const tabCounts = useMemo(() => ({
    all: alerts.length,
    overdue: alerts.filter(a => a.alert_type === 'overdue').length,
    imminent: alerts.filter(a => a.alert_type === 'imminent').length,
    upcoming: alerts.filter(a => a.alert_type === 'upcoming').length,
  }), [alerts])

  // Get badge style for tab
  const getTabBadgeStyle = (tabId: TabId): string => {
    switch (tabId) {
      case 'overdue':
        return 'bg-red-100 text-red-600'
      case 'imminent':
        return 'bg-amber-100 text-amber-600'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const handleMarkRead = async (alertId: string) => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await alertsApi.markRead(token, alertId)
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a))
      toast.success('Alertă marcată ca citită')
    } catch (error) {
      toast.error('A apărut o eroare')
    }
  }

  const handleDismiss = async (alertId: string) => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await alertsApi.markRead(token, alertId)
      setAlerts(prev => prev.filter(a => a.id !== alertId))
      toast.success('Alertă eliminată')
    } catch (error) {
      toast.error('A apărut o eroare')
    }
  }

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await alertsApi.markAllRead(token)
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
      toast.success('Toate alertele au fost marcate ca citite')
    } catch (error) {
      toast.error('A apărut o eroare')
    }
  }

  const handleGenerateAlerts = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setIsGenerating(true)
    try {
      const result = await alertsApi.generate(token)
      toast.success(result.message)
      fetchAlerts()
    } catch (error) {
      toast.error('A apărut o eroare')
    } finally {
      setIsGenerating(false)
    }
  }

  const unreadCount = alerts.filter(a => !a.is_read).length

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Centru de Alerte
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Monitorizare automată a termenelor critice
            </p>
            {unreadCount > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {unreadCount} {unreadCount === 1 ? 'alertă necitită' : 'alerte necitite'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateAlerts}
              disabled={isGenerating}
              className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} strokeWidth={1.5} />
              Regenerează
            </button>
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Check className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
              Marchează toate
            </button>
          </div>
        </div>

        {/* Tabs - Full Width Border Bottom */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-slate-900 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {tabCounts[tab.id] > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${getTabBadgeStyle(tab.id)}`}>
                      {tabCounts[tab.id]}
                    </span>
                  )}
                </span>

                {/* Active Indicator */}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <span className="text-sm">Se încarcă alertele...</span>
            </div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <EmptyState activeTab={activeTab} />
        ) : (
          <div>
            {/* Results count */}
            <p className="text-xs text-gray-500 mb-4">
              {filteredAlerts.length} {filteredAlerts.length === 1 ? 'alertă' : 'alerte'}
              {activeTab !== 'all' && ` în categoria "${TABS.find(t => t.id === activeTab)?.label}"`}
            </p>

            {/* Alert Cards */}
            <div>
              {filteredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onMarkRead={handleMarkRead}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
