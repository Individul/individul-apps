'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { alertsApi, Alert, PaginatedResponse } from '@/lib/api'
import { formatDate } from '@/lib/utils'

function getAlertBadge(alertType: string) {
  switch (alertType) {
    case 'overdue':
      return <Badge variant="destructive">Depășit</Badge>
    case 'imminent':
      return <Badge variant="outline">≤ 30 zile</Badge>
    case 'upcoming':
      return <Badge className="bg-muted text-muted-foreground">30-90 zile</Badge>
    case 'fulfilled':
      return <Badge className="bg-secondary">Îndeplinit</Badge>
    default:
      return null
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'high':
      return <Badge variant="destructive">Ridicată</Badge>
    case 'medium':
      return <Badge variant="outline">Medie</Badge>
    case 'low':
      return <Badge className="bg-secondary">Scăzută</Badge>
    default:
      return null
  }
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([])
  const [activeTab, setActiveTab] = useState('all')
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
      filterAlerts(data.results, activeTab)
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

  const filterAlerts = (alertsList: Alert[], tab: string) => {
    if (tab === 'all') {
      setFilteredAlerts(alertsList)
    } else {
      setFilteredAlerts(alertsList.filter(a => a.alert_type === tab))
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    filterAlerts(alerts, tab)
  }

  const handleMarkRead = async (alertId: string) => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await alertsApi.markRead(token, alertId)
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a))
      filterAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a), activeTab)
    } catch (error) {
      toast.error('A apărut o eroare')
    }
  }

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await alertsApi.markAllRead(token)
      const updatedAlerts = alerts.map(a => ({ ...a, is_read: true }))
      setAlerts(updatedAlerts)
      filterAlerts(updatedAlerts, activeTab)
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Alerte</h1>
            <p className="text-muted-foreground">
              {unreadCount} alerte necitite din {alerts.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleGenerateAlerts} disabled={isGenerating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Regenerează
            </Button>
            <Button variant="outline" onClick={handleMarkAllRead}>
              <Check className="h-4 w-4 mr-2" />
              Marchează toate
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">Toate ({alerts.length})</TabsTrigger>
            <TabsTrigger value="overdue">
              Depășite ({alerts.filter(a => a.alert_type === 'overdue').length})
            </TabsTrigger>
            <TabsTrigger value="imminent">
              Iminente ({alerts.filter(a => a.alert_type === 'imminent').length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              În curând ({alerts.filter(a => a.alert_type === 'upcoming').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader>
                <CardTitle>Lista Alertelor</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">Se încarcă...</p>
                  </div>
                ) : filteredAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nu există alerte în această categorie</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {filteredAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`flex items-start justify-between p-4 rounded-lg border ${
                            alert.is_read ? 'bg-muted/30' : 'bg-background'
                          }`}
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              {getAlertBadge(alert.alert_type)}
                              {getPriorityBadge(alert.priority)}
                              {!alert.is_read && (
                                <Badge variant="default" className="ml-auto">Nou</Badge>
                              )}
                            </div>
                            <Link
                              href={`/persons/${alert.person}`}
                              className="font-medium hover:underline"
                            >
                              {alert.person_name}
                            </Link>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Fracție: {alert.fraction_type}</span>
                              <span>Data țintă: {formatDate(alert.target_date)}</span>
                            </div>
                          </div>
                          {!alert.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkRead(alert.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
