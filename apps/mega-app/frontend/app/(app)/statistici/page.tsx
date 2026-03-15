'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Calendar, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import rawData from '@/data/raport-termen.json'

interface ConvictedPerson {
  nr: number
  nume: string
  prenume: string
  patronimic: string | null
  datasfarsit: string
}

interface MonthGroup {
  month: number
  monthName: string
  persons: ConvictedPerson[]
}

interface YearGroup {
  year: number
  months: MonthGroup[]
  totalCount: number
}

const MONTH_NAMES = [
  '', 'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
]

function buildGroupedData(data: ConvictedPerson[], searchQuery: string): YearGroup[] {
  const query = searchQuery.toLowerCase().trim()
  const filtered = query
    ? data.filter(p =>
        p.nume.toLowerCase().includes(query) ||
        p.prenume.toLowerCase().includes(query) ||
        (p.patronimic && p.patronimic.toLowerCase().includes(query))
      )
    : data

  const yearMap = new Map<number, Map<number, ConvictedPerson[]>>()

  for (const person of filtered) {
    if (!person.datasfarsit) continue
    const [yearStr, monthStr] = person.datasfarsit.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)

    if (!yearMap.has(year)) yearMap.set(year, new Map())
    const monthMap = yearMap.get(year)!
    if (!monthMap.has(month)) monthMap.set(month, [])
    monthMap.get(month)!.push(person)
  }

  const years: YearGroup[] = []
  for (const [year, monthMap] of Array.from(yearMap.entries()).sort((a, b) => a[0] - b[0])) {
    const months: MonthGroup[] = []
    let totalCount = 0
    for (const [month, persons] of Array.from(monthMap.entries()).sort((a, b) => a[0] - b[0])) {
      persons.sort((a, b) => a.datasfarsit.localeCompare(b.datasfarsit) || a.nume.localeCompare(b.nume))
      months.push({ month, monthName: MONTH_NAMES[month], persons })
      totalCount += persons.length
    }
    years.push({ year, months, totalCount })
  }

  return years
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

export default function StatisticiPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => new Set([2026, 2027]))
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set(['2026-3']))

  const data = rawData as ConvictedPerson[]
  const groupedData = useMemo(() => buildGroupedData(data, searchQuery), [data, searchQuery])
  const totalFiltered = useMemo(() => groupedData.reduce((sum, y) => sum + y.totalCount, 0), [groupedData])

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const expandAll = () => {
    const years = new Set(groupedData.map(y => y.year))
    const months = new Set<string>()
    groupedData.forEach(y => y.months.forEach(m => months.add(`${y.year}-${m.month}`)))
    setExpandedYears(years)
    setExpandedMonths(months)
  }

  const collapseAll = () => {
    setExpandedYears(new Set())
    setExpandedMonths(new Set())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Statistici Termen</h1>
          <p className="text-sm text-gray-500 mt-1">
            {searchQuery ? `${totalFiltered} din ${data.length}` : `${data.length}`} persoane
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cauta dupa nume..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {groupedData.map(yearGroup => (
          <Card
            key={yearGroup.year}
            className={`cursor-pointer transition-all hover:shadow-md ${
              expandedYears.has(yearGroup.year) ? 'border-slate-400 bg-slate-50' : 'hover:border-slate-300'
            }`}
            onClick={() => toggleYear(yearGroup.year)}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{yearGroup.year}</p>
              <p className="text-sm text-gray-500">{yearGroup.totalCount} persoane</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Expand/Collapse buttons */}
      <div className="flex gap-2">
        <button
          onClick={expandAll}
          className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded border border-gray-200 hover:border-slate-300 transition-colors"
        >
          Expandeaza tot
        </button>
        <button
          onClick={collapseAll}
          className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded border border-gray-200 hover:border-slate-300 transition-colors"
        >
          Colaseaza tot
        </button>
      </div>

      {/* Year sections */}
      <div className="space-y-3">
        {groupedData.map(yearGroup => (
          <div key={yearGroup.year} className="rounded-lg border border-gray-200 overflow-hidden">
            {/* Year header */}
            <button
              onClick={() => toggleYear(yearGroup.year)}
              className="w-full flex items-center justify-between px-5 py-3 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {expandedYears.has(yearGroup.year) ? (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                )}
                <span className="text-lg font-semibold text-slate-800">{yearGroup.year}</span>
                <Badge variant="secondary" className="text-xs">
                  {yearGroup.totalCount} persoane
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                {yearGroup.months.length} {yearGroup.months.length === 1 ? 'luna' : 'luni'}
              </div>
            </button>

            {/* Months within year */}
            {expandedYears.has(yearGroup.year) && (
              <div className="border-t border-gray-100">
                {yearGroup.months.map(monthGroup => {
                  const monthKey = `${yearGroup.year}-${monthGroup.month}`
                  const isMonthExpanded = expandedMonths.has(monthKey)

                  return (
                    <div key={monthKey} className="border-b border-gray-50 last:border-b-0">
                      {/* Month header */}
                      <button
                        onClick={() => toggleMonth(monthKey)}
                        className="w-full flex items-center justify-between px-5 py-2.5 pl-10 bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isMonthExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">
                            {monthGroup.monthName} {yearGroup.year}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            {monthGroup.persons.length}
                          </Badge>
                        </div>
                      </button>

                      {/* Person table */}
                      {isMonthExpanded && (
                        <div className="px-5 pl-14 pb-3">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-b border-gray-100">
                                <TableHead className="text-xs w-12">Nr.</TableHead>
                                <TableHead className="text-xs">Nume</TableHead>
                                <TableHead className="text-xs">Prenume</TableHead>
                                <TableHead className="text-xs">Patronimic</TableHead>
                                <TableHead className="text-xs w-28">Sfarsit termen</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {monthGroup.persons.map((person, idx) => (
                                <TableRow key={`${person.nr}-${idx}`} className="border-b border-gray-50">
                                  <TableCell className="text-xs text-gray-400 tabular-nums py-1.5">{person.nr}</TableCell>
                                  <TableCell className="text-sm font-medium text-slate-800 py-1.5">{person.nume}</TableCell>
                                  <TableCell className="text-sm text-slate-700 py-1.5">{person.prenume}</TableCell>
                                  <TableCell className="text-sm text-slate-500 py-1.5">{person.patronimic || '—'}</TableCell>
                                  <TableCell className="text-sm font-mono text-slate-700 tabular-nums py-1.5">
                                    {formatDate(person.datasfarsit)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
