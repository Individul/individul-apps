'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, CheckCheck, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AppLayout } from '@/components/layout/app-layout'
import { notificationsApi, Notification, PaginatedResponse } from '@/lib/api'
import { formatDateTime, cn } from '@/lib/utils'

const typeIcons: Record<string, typeof Bell> = {
  due_soon: Clock,
  overdue: AlertTriangle,
  assigned: Bell,
  status_changed: Bell,
}

const typeVariants: Record<string, 'default' | 'warning' | 'destructive'> = {
  due_soon: 'warning',
  overdue: 'destructive',
  assigned: 'default',
  status_changed: 'default',
}

export default function NotificationsPage() {
  const router = useRouter()
  const [data, setData] = useState<PaginatedResponse<Notification> | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const result = await notificationsApi.list(token)
      setData(result)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [router])

  const handleMarkRead = async (id: string) => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await notificationsApi.markRead(token, id)
      fetchNotifications()
    } catch {
      toast.error('A apărut o eroare')
    }
  }

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await notificationsApi.markAllRead(token)
      fetchNotifications()
      toast.success('Toate notificările au fost marcate ca citite')
    } catch {
      toast.error('A apărut o eroare')
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Notificări</h1>
          {data && data.results.some(n => !n.is_read) && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Marchează toate ca citite
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Toate notificările</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : data?.results && data.results.length > 0 ? (
              <div className="space-y-2">
                {data.results.map((notification) => {
                  const Icon = typeIcons[notification.type] || Bell
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-lg border transition-colors',
                        !notification.is_read && 'bg-muted/50'
                      )}
                    >
                      <div className={cn(
                        'p-2 rounded-full',
                        notification.type === 'overdue' ? 'bg-red-100' :
                        notification.type === 'due_soon' ? 'bg-yellow-100' :
                        'bg-muted'
                      )}>
                        <Icon className={cn(
                          'h-4 w-4',
                          notification.type === 'overdue' ? 'text-red-600' :
                          notification.type === 'due_soon' ? 'text-yellow-600' :
                          'text-muted-foreground'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={typeVariants[notification.type] || 'default'}>
                            {notification.type_display}
                          </Badge>
                          {!notification.is_read && (
                            <Badge variant="secondary" className="text-xs">Nouă</Badge>
                          )}
                        </div>
                        <p className="text-sm">{notification.message}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <Link
                            href={`/petitii/petitions/${notification.petition}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {notification.petition_number}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(notification.created_at)}
                          </span>
                        </div>
                      </div>
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkRead(notification.id)}
                        >
                          Marchează citit
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nu aveți notificări</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
