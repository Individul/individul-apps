'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, ChevronRight, User } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { personsApi, Person, PaginatedResponse } from '@/lib/api'
import { formatDate } from '@/lib/utils'

// Filter tabs configuration
const FILTER_TABS = [
  { id: 'all', label: 'Toți' },
  { id: 'active', label: 'Activi' },
  { id: 'alerts', label: 'Cu Alerte' },
  { id: 'archive', label: 'Arhivă' },
] as const

type FilterTab = typeof FILTER_TABS[number]['id']

// Get initials from full name
function getInitials(fullName: string): string {
  const parts = fullName.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return fullName.substring(0, 2).toUpperCase()
}

// Calculate alert status from fraction date
function getAlertStatus(fractionDate: string | null): string | null {
  if (!fractionDate) return null
  const today = new Date()
  const targetDate = new Date(fractionDate)
  const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 30) return 'imminent'
  if (diffDays <= 90) return 'upcoming'
  return 'distant'
}

// Get days until fraction
function getDaysUntil(fractionDate: string | null): number | null {
  if (!fractionDate) return null
  const today = new Date()
  const targetDate = new Date(fractionDate)
  return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Generate a deterministic "random" number from a string (for mock progress)
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Person Row Card Component
function PersonCard({ person }: { person: Person }) {
  const alertStatus = getAlertStatus(person.nearest_fraction_date)
  const daysUntil = getDaysUntil(person.nearest_fraction_date)
  const initials = getInitials(person.full_name)

  // Determine if date should be highlighted (urgent)
  const isUrgent = alertStatus === 'overdue' || alertStatus === 'imminent'

  // Calculate a mock progress based on person ID (deterministic)
  // In a real app, this would come from the API
  const progressPercent = useMemo(() => {
    if (person.active_sentences_count === 0) return 0
    const hash = hashCode(person.id)
    return Math.min((hash % 60) + 25, 100)
  }, [person.id, person.active_sentences_count])

  return (
    <Link
      href={`/persons/${person.id}`}
      className="group block bg-white border border-gray-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-sm transition-all mb-3"
    >
      <div className="flex items-center gap-4">
        {/* Left - Identity */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="w-10 h-10 bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center rounded-full shrink-0">
            {initials}
          </div>

          {/* Name & ID */}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-slate-700">
              {person.full_name}
            </h3>
            <p className="text-xs text-gray-400 font-mono tracking-wide">
              ID: {person.id.substring(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Middle - Status Badge */}
        <div className="hidden sm:flex items-center gap-3">
          <span className="inline-flex items-center px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-100 rounded text-xs">
            {person.active_sentences_count} {person.active_sentences_count === 1 ? 'sentință' : 'sentințe'}
          </span>

          {person.nearest_fraction_type && (
            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-mono">
              {person.nearest_fraction_type}
            </span>
          )}
        </div>

        {/* Right - Critical Info */}
        <div className="flex items-center gap-4">
          {person.nearest_fraction_date ? (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">
                Urm. Fracție
              </p>
              <p className={`text-sm font-mono tabular-nums ${
                isUrgent ? 'text-red-600 font-semibold' : 'text-slate-700'
              }`}>
                {formatDate(person.nearest_fraction_date)}
              </p>
              {daysUntil !== null && (
                <p className={`text-[10px] mt-0.5 ${
                  isUrgent ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {daysUntil < 0
                    ? `${Math.abs(daysUntil)} zile depășit`
                    : `${daysUntil} zile rămase`}
                </p>
              )}
            </div>
          ) : (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">
                Status
              </p>
              <p className="text-xs text-gray-500">
                Fără termene
              </p>
            </div>
          )}

          {/* Chevron */}
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-slate-500 transition-colors shrink-0" />
        </div>
      </div>

      {/* Progress Bar - Micro Detail */}
      {person.active_sentences_count > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400">Progres executare</span>
            <span className="text-[10px] text-gray-500 tabular-nums">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  )
}

export default function PersonsPage() {
  const router = useRouter()
  const [persons, setPersons] = useState<Person[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    const params = new URLSearchParams()
    if (searchQuery) {
      params.set('search', searchQuery)
    }

    personsApi.list(token, params)
      .then((data: PaginatedResponse<Person>) => {
        setPersons(data.results)
        setTotalCount(data.count)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [router, searchQuery])

  // Filter persons based on active tab
  const filteredPersons = useMemo(() => {
    return persons.filter(person => {
      const alertStatus = getAlertStatus(person.nearest_fraction_date)

      switch (activeFilter) {
        case 'active':
          return person.active_sentences_count > 0
        case 'alerts':
          return alertStatus === 'overdue' || alertStatus === 'imminent'
        case 'archive':
          return person.active_sentences_count === 0
        default:
          return true
      }
    })
  }, [persons, activeFilter])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setIsLoading(true)
  }

  // Count for each filter tab
  const filterCounts = useMemo(() => {
    return {
      all: persons.length,
      active: persons.filter(p => p.active_sentences_count > 0).length,
      alerts: persons.filter(p => {
        const status = getAlertStatus(p.nearest_fraction_date)
        return status === 'overdue' || status === 'imminent'
      }).length,
      archive: persons.filter(p => p.active_sentences_count === 0).length,
    }
  }, [persons])

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              Persoane Condamnate
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Registru electronic de evidență și monitorizare
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {totalCount} {totalCount === 1 ? 'înregistrare' : 'înregistrări'} în total
            </p>
          </div>
          <Link
            href="/persons/new"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4 mr-1.5" strokeWidth={2} />
            Adaugă persoană
          </Link>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Search */}
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Caută după nume sau nr. dosar..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full h-10 pl-10 pr-4 bg-white border border-gray-200 rounded-md text-sm text-slate-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-colors"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {filterCounts[tab.id] > 0 && (
                  <span className={`ml-1.5 text-xs ${
                    activeFilter === tab.id ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {filterCounts[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Persons List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <span className="text-sm">Se încarcă registrul...</span>
            </div>
          </div>
        ) : filteredPersons.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-6 w-6 text-slate-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-medium text-slate-800 mb-1">
              {activeFilter === 'all' ? 'Nicio persoană înregistrată' : 'Nicio persoană în această categorie'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {activeFilter === 'all'
                ? 'Începeți prin a adăuga prima persoană în registru'
                : 'Încercați să schimbați filtrul sau criteriile de căutare'
              }
            </p>
            {activeFilter === 'all' && (
              <Link
                href="/persons/new"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-md shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4 mr-1.5" strokeWidth={2} />
                Adaugă persoană
              </Link>
            )}
          </div>
        ) : (
          <div>
            {/* Results count */}
            <p className="text-xs text-gray-500 mb-3">
              {filteredPersons.length} {filteredPersons.length === 1 ? 'rezultat' : 'rezultate'}
              {activeFilter !== 'all' && ` în categoria "${FILTER_TABS.find(t => t.id === activeFilter)?.label}"`}
            </p>

            {/* Person Cards */}
            <div>
              {filteredPersons.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
