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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
          <h1 className="text-2xl font-semibold">Panou principal</h1>
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
        <h1 className="text-2xl font-semibold">Panou principal</h1>

        {/* Main stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/petitions">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Petiții
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.total || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Toate petițiile din sistem
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/petitions?due_filter=due_soon">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-yellow-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Scadente în curând
                </CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">
                  {stats?.due_soon || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Termen în următoarele 3 zile
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/petitions?due_filter=overdue">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-red-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Termen depășit
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  {stats?.overdue || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Necesită atenție imediată
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/petitions?status=solutionata">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-green-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Soluționate
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stats?.by_status?.solutionata || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Petiții finalizate
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Status breakdown */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Petiții pe status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.by_status && Object.entries(stats.by_status).map(([status, count]) => (
                  <Link
                    key={status}
                    href={`/petitii/petitions?status=${status}`}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{statusLabels[status] || status}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{count}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
                {(!stats?.by_status || Object.keys(stats.by_status).length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nu există petiții
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acțiuni rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/petitions/new"
                className="flex items-center justify-between p-3 rounded-md border hover:bg-muted transition-colors"
              >
                <span className="font-medium">Înregistrare petiție nouă</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/petitions?due_filter=overdue"
                className="flex items-center justify-between p-3 rounded-md border hover:bg-muted transition-colors"
              >
                <span className="font-medium">Petiții cu termen depășit</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/reports"
                className="flex items-center justify-between p-3 rounded-md border hover:bg-muted transition-colors"
              >
                <span className="font-medium">Generare raport</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
