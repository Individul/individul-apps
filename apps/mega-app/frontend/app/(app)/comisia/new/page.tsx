'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Save, Search, X, Plus, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import {
  commissionsApi,
  CommissionPersonSearchResult,
  CommissionSessionCreate,
  COMMISSION_ARTICLES,
  PROGRAM_RESULTS,
  BEHAVIOR_RESULTS,
  DECISION_OPTIONS,
} from '@/lib/api'

interface ArticleData {
  article: string
  enabled: boolean
  program_result: string
  behavior_result: string
  decision: string
  notes: string
}

interface PersonEvaluation {
  person_id: string
  person_name: string
  person_cnp: string
  notes: string
  articles: ArticleData[]
}

export default function NewCommissionSessionPage() {
  const router = useRouter()

  const [sessionDate, setSessionDate] = useState<Date | undefined>(new Date())
  const [sessionNumber, setSessionNumber] = useState('')
  const [description, setDescription] = useState('')
  const [evaluations, setEvaluations] = useState<PersonEvaluation[]>([])
  const [saving, setSaving] = useState(false)

  // Person search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CommissionPersonSearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    searchTimeout.current = setTimeout(async () => {
      const token = localStorage.getItem('access_token')
      if (!token) return
      try {
        const results = await commissionsApi.personsSearch(token, query)
        setSearchResults(results)
        setShowResults(true)
      } catch {
        setSearchResults([])
      }
    }, 300)
  }, [])

  const addPerson = (person: CommissionPersonSearchResult) => {
    // Check if already added
    if (evaluations.some(e => e.person_id === person.id)) {
      toast.error('Persoana este deja adaugata')
      return
    }

    const newEval: PersonEvaluation = {
      person_id: person.id,
      person_name: person.full_name,
      person_cnp: person.cnp,
      notes: '',
      articles: COMMISSION_ARTICLES.map(a => ({
        article: a.value,
        enabled: false,
        program_result: 'realizat',
        behavior_result: 'pozitiv',
        decision: 'admis',
        notes: '',
      })),
    }

    setEvaluations(prev => [...prev, newEval])
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
  }

  const removePerson = (personId: string) => {
    setEvaluations(prev => prev.filter(e => e.person_id !== personId))
  }

  const updateArticle = (personIdx: number, articleIdx: number, field: keyof ArticleData, value: any) => {
    setEvaluations(prev => {
      const updated = [...prev]
      updated[personIdx] = {
        ...updated[personIdx],
        articles: updated[personIdx].articles.map((a, i) =>
          i === articleIdx ? { ...a, [field]: value } : a
        ),
      }
      return updated
    })
  }

  const updateEvalNotes = (personIdx: number, notes: string) => {
    setEvaluations(prev => {
      const updated = [...prev]
      updated[personIdx] = { ...updated[personIdx], notes }
      return updated
    })
  }

  const handleSave = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    if (!sessionDate) {
      toast.error('Selectati data sedintei')
      return
    }

    if (evaluations.length === 0) {
      toast.error('Adaugati cel putin o persoana')
      return
    }

    // Validate at least one article enabled per person
    for (const ev of evaluations) {
      const enabledArticles = ev.articles.filter(a => a.enabled)
      if (enabledArticles.length === 0) {
        toast.error(`Selectati cel putin un articol pentru ${ev.person_name}`)
        return
      }
    }

    setSaving(true)
    try {
      const data: CommissionSessionCreate = {
        session_date: format(sessionDate, 'yyyy-MM-dd'),
        session_number: sessionNumber || undefined,
        description: description || undefined,
        evaluations: evaluations.map(ev => ({
          person: ev.person_id,
          notes: ev.notes || undefined,
          article_results: ev.articles
            .filter(a => a.enabled)
            .map(a => ({
              article: a.article,
              program_result: a.program_result,
              behavior_result: a.behavior_result,
              decision: a.decision,
              notes: a.notes || undefined,
            })),
        })),
      }
      await commissionsApi.create(token, data)
      toast.success('Sedinta salvata cu succes')
      router.push('/comisia')
    } catch (err: any) {
      toast.error(err.message || 'Eroare la salvare')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/comisia">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sedinta noua</h1>
            <p className="text-sm text-slate-500 mt-1">Creati o noua sedinta a comisiei penitenciare</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Se salveaza...' : 'Salveaza'}
        </Button>
      </div>

      {/* Session Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalii sedinta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-start gap-6">
            <div className="w-[220px]">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Data sedintei</label>
              <div className="mt-1">
                <DatePicker
                  date={sessionDate}
                  onSelect={setSessionDate}
                  placeholder="Selecteaza data"
                />
              </div>
            </div>
            <div className="w-[220px]">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Numar sedinta (optional)</label>
              <Input
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value)}
                placeholder="ex: Sedinta nr. 5"
                className="mt-1"
              />
            </div>
            <div className="flex-1 min-w-[300px]">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Descriere (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descriere sedinta..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Person Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cautare persoana condamnata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Cautati dupa nume, prenume sau CNP..."
                className="pl-10"
              />
            </div>
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {searchResults.map((person) => {
                  const isAdded = evaluations.some(e => e.person_id === person.id)
                  return (
                    <button
                      key={person.id}
                      onClick={() => !isAdded && addPerson(person)}
                      disabled={isAdded}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${isAdded ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div>
                        <div className="font-medium text-sm text-slate-900">{person.full_name}</div>
                        {person.cnp && (
                          <div className="text-xs text-slate-400">CNP: {person.cnp}</div>
                        )}
                      </div>
                      {isAdded ? (
                        <Badge variant="outline" className="text-[10px]">Adaugat</Badge>
                      ) : (
                        <Plus className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Evaluations per person */}
      {evaluations.map((ev, personIdx) => (
        <Card key={ev.person_id} className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-full">
                  <span className="text-sm font-semibold text-slate-600">
                    {personIdx + 1}
                  </span>
                </div>
                <div>
                  <CardTitle className="text-base">{ev.person_name}</CardTitle>
                  {ev.person_cnp && (
                    <p className="text-xs text-slate-400 mt-0.5">CNP: {ev.person_cnp}</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removePerson(ev.person_id)}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Articles checkboxes and selects */}
            <div className="space-y-3">
              {ev.articles.map((art, artIdx) => {
                const artLabel = COMMISSION_ARTICLES.find(a => a.value === art.article)?.label || art.article
                return (
                  <div key={art.article} className={`rounded-lg border p-4 transition-colors ${art.enabled ? 'border-slate-300 bg-white' : 'border-slate-100 bg-slate-50/50'}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`${ev.person_id}-${art.article}`}
                        checked={art.enabled}
                        onCheckedChange={(checked) => updateArticle(personIdx, artIdx, 'enabled', !!checked)}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor={`${ev.person_id}-${art.article}`}
                        className={`text-sm font-medium cursor-pointer ${art.enabled ? 'text-slate-900' : 'text-slate-400'}`}
                      >
                        {artLabel}
                      </label>
                    </div>

                    {art.enabled && (
                      <div className="mt-3 ml-7 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Program</label>
                          <Select
                            value={art.program_result}
                            onValueChange={(v) => updateArticle(personIdx, artIdx, 'program_result', v)}
                          >
                            <SelectTrigger className="mt-1 h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROGRAM_RESULTS.map(pr => (
                                <SelectItem key={pr.value} value={pr.value}>{pr.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Comportament</label>
                          <Select
                            value={art.behavior_result}
                            onValueChange={(v) => updateArticle(personIdx, artIdx, 'behavior_result', v)}
                          >
                            <SelectTrigger className="mt-1 h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BEHAVIOR_RESULTS.map(br => (
                                <SelectItem key={br.value} value={br.value}>{br.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Decizie</label>
                          <Select
                            value={art.decision}
                            onValueChange={(v) => updateArticle(personIdx, artIdx, 'decision', v)}
                          >
                            <SelectTrigger className="mt-1 h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DECISION_OPTIONS.map(d => (
                                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Observatii</label>
                          <Input
                            value={art.notes}
                            onChange={(e) => updateArticle(personIdx, artIdx, 'notes', e.target.value)}
                            placeholder="Optional..."
                            className="mt-1 h-9 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Evaluation notes */}
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Observatii generale (optional)</label>
              <Input
                value={ev.notes}
                onChange={(e) => updateEvalNotes(personIdx, e.target.value)}
                placeholder="Observatii pentru aceasta persoana..."
                className="mt-1 text-sm"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Empty state for no evaluations */}
      {evaluations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-slate-600">Nicio persoana adaugata</h3>
            <p className="text-sm text-slate-400 mt-1">Cautati si adaugati persoane condamnate pentru evaluare.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
