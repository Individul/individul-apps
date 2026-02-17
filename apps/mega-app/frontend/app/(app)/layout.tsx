'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'
import { GlobalSearch } from '@/components/layout/global-search'
import { notificationsApi } from '@/lib/api'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<{ full_name: string; role: string } | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    // Decode JWT for user info
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUser({ full_name: payload.full_name, role: payload.role })
    } catch {
      router.push('/login')
    }

    // Fetch notification count
    notificationsApi.unreadCount(token)
      .then(data => setUnreadCount(data.count))
      .catch(() => {})
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user} unreadCount={unreadCount} />

      {/* User footer in sidebar */}
      <div className="fixed bottom-0 left-0 w-60 bg-white border-r border-gray-200/80 border-t border-gray-100 p-4 hidden lg:block z-40">
        <div className="flex items-center gap-3 p-2 rounded-lg">
          <div className="flex items-center justify-center w-9 h-9 bg-slate-800 rounded-full">
            <span className="text-sm font-semibold text-white">
              {user?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.full_name || 'Utilizator'}</p>
            <p className="text-xs text-slate-400">{user?.role || 'User'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2.5 mt-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-gray-50 rounded-md transition-colors"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Deconectare
        </button>
      </div>

      {/* Main content */}
      <main className="lg:pl-60 min-h-screen">
        {/* Top bar with search */}
        <div className="sticky top-0 z-30 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
          <div className="px-6 lg:px-8 py-3 max-w-7xl mx-auto flex items-center justify-between gap-4">
            <GlobalSearch />
          </div>
        </div>

        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
