'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, Search, X, Plus, Calendar, User, Clock, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import {
  commissionsApi,
  CommissionSessionDetail,
  CommissionPersonSearchResult,
  CommissionSessionUpdate,
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

export default function CommissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [session, setSession] = useState<CommissionSessionDetail | null>(null)
  const [sessionDate, setSessionDate] = useState<Date | undefined>()
  const [sessionNumber, setSessionNumber] = useState('')
  const [description, setDescription] = useState('')
  const [evaluations, setEvaluations] = useState<PersonEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set())

  // Person search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CommissionPersonSearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.push('/login'); return }

    setLoading(true)
    try {
      const detail = await commissionsApi.get(token, id)
      setSession(detail)
      setSessionDate(new Date(detail.session_date))
      setSessionNumber(detail.session_number || '')
      setDescription(detail.description || '')

      // Build evaluations from existing data
      const evals: PersonEvaluation[] = detail.evaluations.map(ev => {
        const existingArticles = new Map(
          ev.article_results.map(ar => [ar.article, ar])
        )

        return {
          person_id: ev.person,
          person_name: ev.person_name,
          person_cnp: ev.person_cnp,
          notes: ev.notes || '',
          articles: COMMISSION_ARTICLES.map(a => {
            const existing = existingArticles.get(a.value)
            return {
              article: a.value,
              enabled: !!existing,
              program_result: existing?.program_result || 'realizat',
              behavior_result: existing?.behavior_result || 'pozitiv',
              decision: existing?.decision || 'admis',
              notes: existing?.notes || '',
            }
          }),
        }
      })

      setEvaluations(evals)
    } catch {
      toast.error('Eroare la incarcarea sedintei')
      router.push('/comisia')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  const toggleExpand = (personId: string) => {
    setExpandedPersons(prev => {
      const next = new Set(prev)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }

  const getArticleSummary = (ev: PersonEvaluation) => {
    const enabled = ev.articles.filter(a => a.enabled)
    if (enabled.length === 0) return 'Niciun articol selectat'
    return enabled.map(a => {
      const label = COMMISSION_ARTICLES.find(c => c.value === a.article)?.label || a.article
      const prog = PROGRAM_RESULTS.find(p => p.value === a.program_result)?.label || a.program_result
      const comp = BEHAVIOR_RESULTS.find(b => b.value === a.behavior_result)?.label || a.behavior_result
      const dec = DECISION_OPTIONS.find(d => d.value === a.decision)?.label || a.decision
      return `${label}: ${prog}, ${comp}, ${dec}`
    }).join(' · ')
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

    for (const ev of evaluations) {
      const enabledArticles = ev.articles.filter(a => a.enabled)
      if (enabledArticles.length === 0) {
        toast.error(`Selectati cel putin un articol pentru ${ev.person_name}`)
        return
      }
    }

    setSaving(true)
    try {
      const data: CommissionSessionUpdate = {
        session_date: format(sessionDate, 'yyyy-MM-dd'),
        session_number: sessionNumber,
        description: description,
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
      await commissionsApi.update(token, id, data)
      toast.success('Sedinta actualizata cu succes')
      router.push('/comisia')
    } catch (err: any) {
      toast.error(err.message || 'Eroare la salvare')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setDeleting(true)
    try {
      await commissionsApi.delete(token, id)
      toast.success('Sedinta stearsa cu succes')
      router.push('/comisia')
    } catch (err: any) {
      toast.error(err.message || 'Eroare la stergere')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: ro })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-32" /><Skeleton className="h-96" /></div>
  }

  if (!session) return null

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
            <h1 className="text-2xl font-bold text-slate-900">Editare sedinta</h1>
            <p className="text-sm text-slate-500 mt-1">Modificati datele sedintei comisiei</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Sterge
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmare stergere</DialogTitle>
                <DialogDescription>
                  Sigur doriti sa stergeti aceasta sedinta? Aceasta actiune nu poate fi anulata.
                  Toate evaluarile si rezultatele asociate vor fi pierdute.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Anuleaza
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Se sterge...' : 'Sterge definitiv'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Se salveaza...' : 'Salveaza'}
          </Button>
        </div>
      </div>

      {/* Session Header Card */}
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

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <User className="h-3.5 w-3.5" />
              <span>Creat de <span className="text-slate-600 font-medium">{session.created_by_name}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>Creat la {formatDateTime(session.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Ultima modificare {formatDateTime(session.updated_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Person Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adauga persoana</CardTitle>
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
      {evaluations.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Persoane evaluate ({evaluations.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {evaluations.map((ev, personIdx) => {
                const isExpanded = expandedPersons.has(ev.person_id)
                const enabledCount = ev.articles.filter(a => a.enabled).length
                return (
                  <div key={ev.person_id}>
                    {/* Compact row */}
                    <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center justify-center w-7 h-7 bg-slate-100 rounded-full flex-shrink-0">
                        <span className="text-xs font-semibold text-slate-600">{personIdx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{ev.person_name}</span>
                          {ev.person_cnp && (
                            <span className="text-[11px] text-slate-400">CNP: {ev.person_cnp}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{getArticleSummary(ev)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-normal">
                          {enabledCount} {enabledCount === 1 ? 'articol' : 'articole'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600"
                          onClick={() => toggleExpand(ev.person_id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => removePerson(ev.person_id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded edit form */}
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 bg-slate-50/40 border-t border-slate-100">
                        <div className="space-y-2.5 mt-2">
                          {ev.articles.map((art, artIdx) => {
                            const artLabel = COMMISSION_ARTICLES.find(a => a.value === art.article)?.label || art.article
                            return (
                              <div key={art.article} className={`rounded-lg border p-3 transition-colors ${art.enabled ? 'border-slate-300 bg-white' : 'border-slate-100 bg-white/60'}`}>
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    id={`${ev.person_id}-${art.article}`}
                                    checked={art.enabled}
                                    onCheckedChange={(checked) => updateArticle(personIdx, artIdx, 'enabled', !!checked)}
                                  />
                                  <label
                                    htmlFor={`${ev.person_id}-${art.article}`}
                                    className={`text-sm font-medium cursor-pointer ${art.enabled ? 'text-slate-900' : 'text-slate-400'}`}
                                  >
                                    {artLabel}
                                  </label>
                                  {art.enabled && (
                                    <div className="flex-1 flex items-center gap-2 ml-2">
                                      <Select
                                        value={art.program_result}
                                        onValueChange={(v) => updateArticle(personIdx, artIdx, 'program_result', v)}
                                      >
                                        <SelectTrigger className="h-8 text-xs w-[130px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {PROGRAM_RESULTS.map(pr => (
                                            <SelectItem key={pr.value} value={pr.value}>{pr.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Select
                                        value={art.behavior_result}
                                        onValueChange={(v) => updateArticle(personIdx, artIdx, 'behavior_result', v)}
                                      >
                                        <SelectTrigger className="h-8 text-xs w-[110px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {BEHAVIOR_RESULTS.map(br => (
                                            <SelectItem key={br.value} value={br.value}>{br.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Select
                                        value={art.decision}
                                        onValueChange={(v) => updateArticle(personIdx, artIdx, 'decision', v)}
                                      >
                                        <SelectTrigger className="h-8 text-xs w-[110px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {DECISION_OPTIONS.map(d => (
                                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        value={art.notes}
                                        onChange={(e) => updateArticle(personIdx, artIdx, 'notes', e.target.value)}
                                        placeholder="Obs..."
                                        className="h-8 text-xs flex-1"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-2.5">
                          <Input
                            value={ev.notes}
                            onChange={(e) => updateEvalNotes(personIdx, e.target.value)}
                            placeholder="Observatii generale pentru aceasta persoana..."
                            className="text-xs h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
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
