'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ListTodo, FileText, Users, Scale, Loader2 } from 'lucide-react'
import { tasksApi, petitionsApi, personsApi, commissionsApi, Task, Petition, Person, CommissionSessionListItem } from '@/lib/api'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  title: string
  subtitle: string
  module: 'tasks' | 'petitii' | 'termene' | 'comisia'
  href: string
}

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Keyboard shortcut: Ctrl+K or /
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) return

    setLoading(true)
    try {
      const params = new URLSearchParams({ search: q.trim() })

      const [tasks, petitions, persons, commissions] = await Promise.all([
        tasksApi.list(token, params).catch(() => [] as Task[]),
        petitionsApi.list(token, params).catch(() => ({ results: [] as Petition[] })),
        personsApi.list(token, params).catch(() => ({ results: [] as Person[] })),
        commissionsApi.list(token, params).catch(() => ({ results: [] as CommissionSessionListItem[] })),
      ])

      const mapped: SearchResult[] = []

      // Tasks
      const taskList = Array.isArray(tasks) ? tasks : []
      taskList.slice(0, 5).forEach((t) => {
        mapped.push({
          id: `task-${t.id}`,
          title: t.title,
          subtitle: `${t.status === 'TODO' ? 'De făcut' : t.status === 'IN_PROGRESS' ? 'În lucru' : 'Finalizat'} · ${t.priority === 'HIGH' ? 'Ridicată' : t.priority === 'MEDIUM' ? 'Medie' : 'Scăzută'}`,
          module: 'tasks',
          href: `/tasks/${t.id}`,
        })
      })

      // Petitions
      const petitionList = 'results' in petitions ? petitions.results : []
      petitionList.slice(0, 5).forEach((p) => {
        mapped.push({
          id: `petition-${p.id}`,
          title: `${p.registration_number} — ${p.petitioner_name}`,
          subtitle: `${p.status_display} · ${p.object_type_display}`,
          module: 'petitii',
          href: `/petitii/${p.id}`,
        })
      })

      // Persons
      const personList = 'results' in persons ? persons.results : []
      personList.slice(0, 5).forEach((p) => {
        mapped.push({
          id: `person-${p.id}`,
          title: p.full_name,
          subtitle: `Admis: ${p.admission_date}${p.release_date ? ' · Eliberat' : ' · Activ'}`,
          module: 'termene',
          href: `/termene/${p.id}`,
        })
      })

      // Commissions
      const commissionList = 'results' in commissions ? commissions.results : (Array.isArray(commissions) ? commissions : [])
      commissionList.slice(0, 5).forEach((c: CommissionSessionListItem) => {
        mapped.push({
          id: `commission-${c.id}`,
          title: `${c.session_date}${c.session_number ? ' — ' + c.session_number : ''}`,
          subtitle: `${c.evaluations_count} persoane · ${c.realizat_count} realizat · ${c.admis_count} admis`,
          module: 'comisia',
          href: `/comisia/${c.id}`,
        })
      })

      setResults(mapped)
      setSelectedIndex(0)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(result.href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      setResults([])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex])
    }
  }

  const moduleStyle = (module: string) => {
    switch (module) {
      case 'tasks': return { icon: 'text-blue-500', border: 'border-l-blue-400', bg: 'bg-blue-50/60' }
      case 'petitii': return { icon: 'text-amber-500', border: 'border-l-amber-400', bg: 'bg-amber-50/60' }
      case 'termene': return { icon: 'text-emerald-500', border: 'border-l-emerald-400', bg: 'bg-emerald-50/60' }
      case 'comisia': return { icon: 'text-violet-500', border: 'border-l-violet-400', bg: 'bg-violet-50/60' }
      default: return { icon: 'text-slate-400', border: 'border-l-slate-300', bg: 'bg-gray-50' }
    }
  }

  const moduleIcon = (module: string) => {
    const style = moduleStyle(module)
    switch (module) {
      case 'tasks': return <ListTodo className={cn("h-3.5 w-3.5", style.icon)} />
      case 'petitii': return <FileText className={cn("h-3.5 w-3.5", style.icon)} />
      case 'termene': return <Users className={cn("h-3.5 w-3.5", style.icon)} />
      case 'comisia': return <Scale className={cn("h-3.5 w-3.5", style.icon)} />
      default: return null
    }
  }

  const moduleLabel = (module: string) => {
    switch (module) {
      case 'tasks': return 'Dosare defecte'
      case 'petitii': return 'Petiții'
      case 'termene': return 'Termene'
      case 'comisia': return 'Comisia'
      default: return module
    }
  }

  // Group results by module
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.module]) acc[r.module] = []
    acc[r.module].push(r)
    return acc
  }, {})

  // Flat list for keyboard navigation index
  let flatIndex = 0

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* Search trigger / input */}
      <div
        className={cn(
          "flex items-center gap-2 bg-white border rounded-lg px-3 py-2 transition-all",
          open ? "border-slate-300 shadow-sm ring-1 ring-slate-200" : "border-gray-200 hover:border-gray-300 cursor-pointer"
        )}
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
      >
        <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Căutare în dosare, petiții, persoane, comisie..."
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm text-slate-400">Căutare...</span>
        )}
        {open && query && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setQuery('')
              setResults([])
              inputRef.current?.focus()
            }}
            className="p-0.5 hover:bg-gray-100 rounded"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
        {!open && (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-gray-100 rounded border border-gray-200">
            Ctrl+K
          </kbd>
        )}
        {loading && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
      </div>

      {/* Dropdown results */}
      {open && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Se caută...</span>
            </div>
          ) : results.length === 0 && query.length >= 2 && !loading ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Niciun rezultat pentru &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(grouped).map(([module, items]) => {
              const style = moduleStyle(module)
              return (
              <div key={module}>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 border-l-2",
                  style.bg, style.border
                )}>
                  {moduleIcon(module)}
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {moduleLabel(module)}
                  </span>
                  <span className="text-[10px] text-slate-400">({items.length})</span>
                </div>
                {items.map((result) => {
                  const currentIndex = flatIndex++
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={cn(
                        "flex items-start gap-3 w-full px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0",
                        currentIndex === selectedIndex ? "bg-slate-50" : "hover:bg-gray-50"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{result.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{result.subtitle}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )})
          )}
        </div>
      )}
    </div>
  )
}
