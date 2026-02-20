'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListTodo,
  FileText,
  Users,
  Bell,
  BarChart3,
  Shield,
  ExternalLink,
  Calculator,
  FileBox,
  ArrowLeftRight,
  Scale,
  Gavel,
  Bug,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
]

const modules = [
  { name: 'Dosare defecte', href: '/tasks', icon: ListTodo },
  { name: 'Petiții', href: '/petitii', icon: FileText },
  { name: 'Termene', href: '/termene', icon: Users },
  { name: 'Transferuri', href: '/transferuri', icon: ArrowLeftRight },
  { name: 'Comisia', href: '/comisia', icon: Scale },
  { name: 'Tracker SIA', href: '/tracker', icon: Bug },
]

const secondary = [
  { name: 'Rapoarte', href: '/reports', icon: BarChart3 },
  { name: 'Administrare', href: '/admin/users', icon: Shield, adminOnly: true },
]

const external = [
  { name: 'Clasificare', href: '/clasificare/', icon: Calculator },
  { name: 'PDF Toolbox', href: '/pdf/', icon: FileBox },
  { name: 'Monitor Ședințe', href: '/monitor/', icon: Gavel },
]

interface SidebarProps {
  user: { full_name: string; role: string } | null
  unreadCount: number
}

export function Sidebar({ user, unreadCount }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const renderLink = (item: typeof navigation[0], showBadge = false) => (
    <Link
      key={item.name}
      href={item.href}
      className={cn(
        'group flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-all',
        isActive(item.href)
          ? 'bg-slate-100 text-slate-900 font-semibold border-l-4 border-slate-800 -ml-px pl-[11px]'
          : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'
      )}
    >
      <item.icon
        className={cn('h-[18px] w-[18px]', isActive(item.href) ? 'text-slate-800' : 'text-slate-400')}
        strokeWidth={isActive(item.href) ? 2 : 1.5}
      />
      <span className="flex-1">{item.name}</span>
      {showBadge && unreadCount > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full">
          {unreadCount}
        </span>
      )}
    </Link>
  )

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-200/80 hidden lg:flex lg:flex-col">
      {/* Header */}
      <div className="px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Shield className="h-5 w-5 text-slate-700" strokeWidth={1.5} />
          <span className="font-semibold text-base text-slate-900 tracking-tight">Hub</span>
        </div>
        <p className="mt-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-medium">
          Sistem Unificat
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => renderLink(item))}

        <div className="py-2">
          <div className="border-t border-gray-100" />
          <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-400 font-medium">
            Module
          </p>
        </div>

        {modules.map((item) => renderLink(item))}

        <div className="py-2">
          <div className="border-t border-gray-100" />
        </div>

        {secondary
          .filter((item) => !item.adminOnly || user?.role === 'admin')
          .map((item) => renderLink(item))}

        <div className="py-2">
          <div className="border-t border-gray-100" />
          <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-400 font-medium">
            Instrumente
          </p>
        </div>

        {external.map((item) => (
          <a
            key={item.name}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-3 py-3 rounded-md text-sm text-slate-500 hover:text-slate-700 hover:bg-gray-50 transition-all"
          >
            <item.icon className="h-[18px] w-[18px] text-slate-400" strokeWidth={1.5} />
            <span className="flex-1">{item.name}</span>
            <ExternalLink className="h-3 w-3 text-slate-300" />
          </a>
        ))}
      </nav>
    </aside>
  )
}
