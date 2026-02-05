'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Clock, AlertTriangle, AlertCircle, CheckCircle, Plus } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
          <p className="text-muted-foreground">Se încarcă...</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Panou principal</h1>
            <p className="text-muted-foreground">Monitorizarea termenelor de executare</p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/persons/new">
                <Plus className="h-4 w-4 mr-2" />
                Adaugă persoană
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Persoane</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_persons || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.persons_with_active_sentences || 0} cu sentințe active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Termene Depășite</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{alertSummary?.overdue || 0}</div>
              <p className="text-xs text-muted-foreground">
                Necesită atenție imediată
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Termene Iminente</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{alertSummary?.imminent || 0}</div>
              <p className="text-xs text-muted-foreground">
                În următoarele 30 de zile
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Îndeplinite</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{alertSummary?.fulfilled || 0}</div>
              <p className="text-xs text-muted-foreground">
                Fracții completate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alert Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Sumar Alerte</CardTitle>
            <CardDescription>Distribuția termenelor pe categorii</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Depășite</Badge>
                  <span className="text-sm text-muted-foreground">Termene care au trecut de data calculată</span>
                </div>
                <span className="font-semibold">{alertSummary?.overdue || 0}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">≤ 30 zile</Badge>
                  <span className="text-sm text-muted-foreground">Termene iminente</span>
                </div>
                <span className="font-semibold">{alertSummary?.imminent || 0}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-muted text-muted-foreground">30-90 zile</Badge>
                  <span className="text-sm text-muted-foreground">Termene în curând</span>
                </div>
                <span className="font-semibold">{alertSummary?.upcoming || 0}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-secondary">Îndeplinite</Badge>
                  <span className="text-sm text-muted-foreground">Fracții completate</span>
                </div>
                <span className="font-semibold">{alertSummary?.fulfilled || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acțiuni Rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/persons">
                  <Users className="h-4 w-4 mr-2" />
                  Vezi toate persoanele
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/alerts">
                  <Clock className="h-4 w-4 mr-2" />
                  Vezi toate alertele
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/reports">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Generează raport
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
