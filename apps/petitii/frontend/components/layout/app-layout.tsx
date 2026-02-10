'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileText,
  LayoutDashboard,
  Bell,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { notificationsApi } from '@/lib/api'

interface AppLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Panou Principal', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Petiții', href: '/petitions', icon: FileText },
  { name: 'Notificări', href: '/notifications', icon: Bell },
  { name: 'Rapoarte', href: '/reports', icon: BarChart3 },
]

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [user, setUser] = useState<{ full_name: string; role: string; department?: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    // Fetch unread notifications count
    notificationsApi.unreadCount(token)
      .then(data => setUnreadCount(data.count))
      .catch(() => {})

    // Get user info from token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUser({ full_name: payload.full_name, role: payload.role, department: payload.department })
    } catch {}
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimalist Light Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-200/80 hidden lg:flex lg:flex-col">
        {/* Header / Logo */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-slate-700" strokeWidth={1.5} />
            <span className="font-semibold text-base text-slate-900 tracking-tight">Registru Petiții</span>
          </div>
          <p className="mt-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-medium">
            Gestionare Solicitări
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-all',
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold border-l-4 border-slate-800 -ml-px pl-[11px]'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'
                )}
              >
                <item.icon
                  className={cn(
                    'h-[18px] w-[18px]',
                    isActive ? 'text-slate-800' : 'text-slate-400'
                  )}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                <span className="flex-1">{item.name}</span>
                {item.name === 'Notificări' && unreadCount > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Section - Footer */}
        <div className="mt-auto border-t border-gray-100 p-4">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <div className="flex items-center justify-center w-9 h-9 bg-slate-800 rounded-full">
              <span className="text-sm font-semibold text-white">
                {user?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {user?.full_name || 'Utilizator'}
              </p>
              <p className="text-xs text-slate-400 capitalize">{user?.department || user?.role || 'User'}</p>
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
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-slate-700" strokeWidth={1.5} />
          <span className="font-semibold text-slate-900">Registru Petiții</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-600 hover:bg-gray-100"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white pt-16">
          <nav className="px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 rounded-md text-base transition-colors',
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold border-l-4 border-slate-800'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'
                  )}
                >
                  <item.icon
                    className={cn('h-5 w-5', isActive ? 'text-slate-800' : 'text-slate-400')}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  {item.name}
                  {item.name === 'Notificări' && unreadCount > 0 && (
                    <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-red-500 text-white rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}

            {/* Mobile User Section */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex items-center justify-center w-10 h-10 bg-slate-800 rounded-full">
                  <span className="text-sm font-semibold text-white">
                    {user?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{user?.full_name || 'Utilizator'}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.department || user?.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3.5 mt-2 text-base text-slate-500 hover:text-slate-700 hover:bg-gray-50 rounded-md transition-colors"
              >
                <LogOut className="h-5 w-5" strokeWidth={1.5} />
                Deconectare
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-60 pt-14 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
