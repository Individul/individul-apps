'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Clock, AlertCircle, X, Calendar, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import {
  personsApi,
  sentencesApi,
  PersonDetail,
  Sentence,
  Fraction,
  SentenceCreate,
  SentenceReductionCreate,
  ApiError,
  CRIME_TYPES,
  SENTENCE_STATUSES,
} from '@/lib/api'
import { formatDate, formatDateForApi } from '@/lib/utils'

// Calculate time served percentage
function calculateTimeServed(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  const now = Date.now()

  if (now <= start) return 0
  if (now >= end) return 100

  const total = end - start
  const served = now - start
  return Math.round((served / total) * 100)
}

function parseApiDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    suspended: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-gray-100 text-gray-600 border-gray-200',
    conditionally_released: 'bg-blue-50 text-blue-700 border-blue-200',
  }

  const labels: Record<string, string> = {
    active: 'Activă',
    suspended: 'Suspendată',
    completed: 'Finalizată',
    conditionally_released: 'Lib. Condiționată',
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.active}`}>
      {labels[status] || status}
    </span>
  )
}

// Fraction Status Badge
function FractionStatusBadge({ status, isFulfilled }: { status: string; isFulfilled: boolean }) {
  if (isFulfilled) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 line-through">
        Îndeplinit
      </span>
    )
  }

  const styles: Record<string, string> = {
    overdue: 'bg-red-50 text-red-700 border border-red-100',
    imminent: 'bg-amber-50 text-amber-700 border border-amber-100',
    upcoming: 'bg-blue-50 text-blue-700 border border-blue-100',
    distant: 'bg-amber-50 text-amber-700 border border-amber-100',
  }

  const labels: Record<string, string> = {
    overdue: 'Depășit',
    imminent: '≤ 30 Zile',
    upcoming: '30-90 Zile',
    distant: '> 90 Zile',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${styles[status] || styles.distant}`}>
      {labels[status] || status}
    </span>
  )
}

// Smart Case File - Sentence Card
function SentenceCard({
  sentence,
  onAddReduction,
  onDeleteReduction,
}: {
  sentence: Sentence
  onAddReduction: (sentenceId: string) => void
  onDeleteReduction: (sentenceId: string, reductionId: string) => void
}) {
  // Use effective_end_date if there are reductions, otherwise use end_date
  const endDateToUse = sentence.reductions && sentence.reductions.length > 0
    ? sentence.effective_end_date
    : sentence.end_date
  const timeServed = calculateTimeServed(sentence.start_date, endDateToUse)

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header - Context Zone */}
      <div className="bg-slate-50 p-5">
        {/* Title & Status Row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {sentence.crime_type_display}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {sentence.duration_display}
              {sentence.reductions && sentence.reductions.length > 0 && (
                <span className="ml-2 text-amber-600">
                  (Efectiv: {sentence.effective_duration_display})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAddReduction(sentence.id)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
            >
              + Reducere
            </button>
            <StatusBadge status={sentence.status} />
          </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">Început</p>
            <p className="text-sm font-mono text-slate-700 tabular-nums">{formatDate(sentence.start_date)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">Sfârșit</p>
            {sentence.reductions && sentence.reductions.length > 0 ? (
              <div>
                <p className="text-sm font-mono text-slate-400 tabular-nums line-through">{formatDate(sentence.end_date)}</p>
                <p className="text-sm font-mono text-emerald-600 tabular-nums font-semibold">{formatDate(sentence.effective_end_date)}</p>
              </div>
            ) : (
              <p className="text-sm font-mono text-slate-700 tabular-nums">{formatDate(sentence.end_date)}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold mb-1">Infracțiune Gravă</p>
            <p className="text-sm font-mono text-slate-700">{sentence.is_serious_crime ? 'Da' : 'Nu'}</p>
          </div>
        </div>
      </div>

      {/* Progress Bar - Time Served */}
      <div className="px-5 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Timp Executat</span>
          <span className="text-xs font-medium text-slate-600 tabular-nums">{timeServed}% Executat</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-600 rounded-full transition-all duration-500"
            style={{ width: `${timeServed}%` }}
          />
        </div>
      </div>

      {/* Fractions Table - Body */}
      <div className="bg-white">
        {/* Table Header */}
        <div className="grid grid-cols-[70px_1fr_120px_100px] px-5 py-3 border-b border-gray-100 bg-white">
          <span className="text-xs uppercase text-gray-400 font-semibold">Fracție</span>
          <span className="text-xs uppercase text-gray-400 font-semibold">Descriere</span>
          <span className="text-xs uppercase text-gray-400 font-semibold">Data</span>
          <span className="text-xs uppercase text-gray-400 font-semibold">Status</span>
        </div>

        {/* Table Rows */}
        {sentence.fractions.map((fraction, index) => (
          <div
            key={fraction.id}
            className={`grid grid-cols-[70px_1fr_120px_100px] px-5 py-3 items-center ${
              index < sentence.fractions.length - 1 ? 'border-b border-gray-50' : ''
            } ${fraction.is_fulfilled ? 'opacity-50' : ''}`}
          >
            {/* Fraction Type - Technical Tag */}
            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-slate-700 font-mono text-xs rounded w-fit">
              {fraction.fraction_type}
            </span>

            {/* Description */}
            <div className="pr-4">
              <p className="text-sm text-slate-700 truncate">{fraction.description}</p>
              {fraction.days_until !== undefined && !fraction.is_fulfilled && (
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {fraction.days_until < 0
                    ? `${Math.abs(fraction.days_until)} zile depășite`
                    : `${fraction.days_until} zile rămase`}
                </p>
              )}
            </div>

            {/* Date */}
            <span className="text-sm font-mono text-slate-700 tabular-nums">
              {formatDate(fraction.calculated_date)}
            </span>

            {/* Status Badge */}
            <FractionStatusBadge status={fraction.alert_status} isFulfilled={fraction.is_fulfilled} />
          </div>
        ))}
      </div>

      {/* Reductions Section */}
      {sentence.reductions && sentence.reductions.length > 0 && (
        <div className="border-t border-gray-100 bg-amber-50/50">
          <div className="px-5 py-3 border-b border-amber-100">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-amber-700 font-semibold">Reduceri Aplicate</span>
              <span className="text-xs text-amber-600 font-medium">
                Total: -{sentence.total_reduction_days} zile
              </span>
            </div>
          </div>
          {sentence.reductions.map((reduction, index) => (
            <div
              key={reduction.id}
              className={`flex items-center justify-between px-5 py-2.5 ${
                index < sentence.reductions.length - 1 ? 'border-b border-amber-100/50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-800 font-mono text-xs rounded">
                  {reduction.legal_article}
                </span>
                <span className="text-sm text-amber-700">
                  -{reduction.reduction_display}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-amber-600 tabular-nums">
                  {formatDate(reduction.applied_date)}
                </span>
                <button
                  onClick={() => onDeleteReduction(sentence.id, reduction.id)}
                  className="p-1 text-amber-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Șterge reducerea"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PersonDetailPage() {
  const router = useRouter()
  const params = useParams()
  const personId = params.id as string

  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingSentence, setIsAddingSentence] = useState(false)
  const [sentenceFormOpen, setSentenceFormOpen] = useState(false)

  const [newSentence, setNewSentence] = useState<SentenceCreate>({
    person: personId,
    crime_type: '',
    crime_description: '',
    sentence_years: 0,
    sentence_months: 0,
    sentence_days: 0,
    start_date: '',
    status: 'active',
    notes: '',
  })
  const [sentenceStartDate, setSentenceStartDate] = useState<Date | undefined>()

  // Reduction form state
  const [reductionFormOpen, setReductionFormOpen] = useState(false)
  const [selectedSentenceForReduction, setSelectedSentenceForReduction] = useState<string | null>(null)
  const [isAddingReduction, setIsAddingReduction] = useState(false)
  const [newReduction, setNewReduction] = useState<SentenceReductionCreate>({
    legal_article: '473/4',
    reduction_years: 0,
    reduction_months: 0,
    reduction_days: 0,
    applied_date: '',
  })
  const [reductionDate, setReductionDate] = useState<Date | undefined>()
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(new Date())
  const [isReleasing, setIsReleasing] = useState(false)

  const fetchPerson = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const data = await personsApi.get(token, personId)
      setPerson(data)
      setReleaseDate(parseApiDate(data.release_date) || new Date())
    } catch (error) {
      console.error(error)
      toast.error('Nu s-a putut încărca persoana')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPerson()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId])

  const handleAddSentence = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    if (!newSentence.crime_type || !sentenceStartDate) {
      toast.error('Completează toate câmpurile obligatorii')
      return
    }

    if (newSentence.sentence_years === 0 && newSentence.sentence_months === 0 && newSentence.sentence_days === 0) {
      toast.error('Trebuie specificată o durată a pedepsei')
      return
    }

    setIsAddingSentence(true)

    try {
      await sentencesApi.create(token, {
        ...newSentence,
        person: personId,
        start_date: formatDateForApi(sentenceStartDate),
      })
      toast.success('Sentința a fost adăugată cu succes')
      setSentenceFormOpen(false)
      setNewSentence({
        person: personId,
        crime_type: '',
        crime_description: '',
        sentence_years: 0,
        sentence_months: 0,
        sentence_days: 0,
        start_date: '',
        status: 'active',
        notes: '',
      })
      setSentenceStartDate(undefined)
      fetchPerson()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare')
      }
    } finally {
      setIsAddingSentence(false)
    }
  }

  const handleDeletePerson = async () => {
    if (!confirm('Sigur doriți să ștergeți această persoană? Toate sentințele vor fi șterse.')) {
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await personsApi.delete(token, personId)
      toast.success('Persoana a fost ștearsă')
      router.push('/persons')
    } catch (error) {
      toast.error('A apărut o eroare')
    }
  }

  const handleReleasePerson = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    if (!releaseDate) {
      toast.error('Selecteaza data eliberarii')
      return
    }

    if (!confirm('Confirmati marcarea persoanei ca eliberata?')) {
      return
    }

    setIsReleasing(true)
    try {
      const response = await personsApi.release(token, personId, {
        release_date: formatDateForApi(releaseDate),
      })
      setPerson(response.person)
      setReleaseDate(parseApiDate(response.person.release_date) || releaseDate)
      toast.success('Persoana a fost marcata ca eliberata')
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A aparut o eroare la eliberare')
      }
    } finally {
      setIsReleasing(false)
    }
  }

  const handleOpenReductionForm = (sentenceId: string) => {
    setSelectedSentenceForReduction(sentenceId)
    setNewReduction({
      legal_article: '473/4',
      reduction_years: 0,
      reduction_months: 0,
      reduction_days: 0,
      applied_date: '',
    })
    setReductionDate(undefined)
    setReductionFormOpen(true)
  }

  const handleAddReduction = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !selectedSentenceForReduction) return

    if (!newReduction.legal_article || !reductionDate) {
      toast.error('Completează toate câmpurile obligatorii')
      return
    }

    if (newReduction.reduction_years === 0 && newReduction.reduction_months === 0 && newReduction.reduction_days === 0) {
      toast.error('Trebuie specificată o durată a reducerii')
      return
    }

    setIsAddingReduction(true)

    try {
      await sentencesApi.addReduction(token, selectedSentenceForReduction, {
        ...newReduction,
        applied_date: formatDateForApi(reductionDate),
      })
      toast.success('Reducerea a fost adăugată')
      setReductionFormOpen(false)
      fetchPerson()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare')
      }
    } finally {
      setIsAddingReduction(false)
    }
  }

  const handleDeleteReduction = async (sentenceId: string, reductionId: string) => {
    if (!confirm('Sigur doriți să ștergeți această reducere? Fracțiile vor fi recalculate.')) {
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await sentencesApi.deleteReduction(token, sentenceId, reductionId)
      toast.success('Reducerea a fost ștearsă')
      fetchPerson()
    } catch (error) {
      toast.error('A apărut o eroare la ștergerea reducerii')
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            <span className="text-sm">Se încarcă...</span>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!person) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <AlertCircle className="h-10 w-10 text-slate-300 mb-4" strokeWidth={1.5} />
          <p className="text-sm text-slate-500 mb-4">Persoana nu a fost găsită</p>
          <Link
            href="/persons"
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors"
          >
            Înapoi la listă
          </Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/persons"
              className="flex items-center justify-center w-9 h-9 rounded-md bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
                {person.full_name}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {person.active_sentences_count} {person.active_sentences_count === 1 ? 'sentință activă' : 'sentințe active'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDeletePerson}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md border border-gray-200 transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
            Șterge
          </button>
        </div>

        {/* MAI Notification Checkbox */}
        <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
          <input
            type="checkbox"
            id="mai_notification"
            checked={person.mai_notification}
            onChange={async (e) => {
              const token = localStorage.getItem('access_token')
              if (!token) return
              const newValue = e.target.checked
              try {
                await personsApi.update(token, personId, { mai_notification: newValue })
                setPerson({ ...person, mai_notification: newValue })
                toast.success(newValue ? 'Înștiințare MAI activată' : 'Înștiințare MAI dezactivată')
              } catch (error) {
                toast.error('Eroare la actualizarea înștiințării MAI')
              }
            }}
            className="h-4 w-4 rounded border-gray-300 text-slate-800 focus:ring-slate-500 cursor-pointer"
          />
          <label htmlFor="mai_notification" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
            Înștiințare MAI
          </label>
        </div>

        {/* Release Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                Data eliberarii
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                <DatePicker
                  date={releaseDate}
                  onSelect={setReleaseDate}
                  placeholder="Selecteaza data eliberarii"
                  className="pl-10"
                />
              </div>
            </div>
            <button
              onClick={handleReleasePerson}
              disabled={!releaseDate || isReleasing}
              className="inline-flex items-center justify-center px-4 h-10 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReleasing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Se proceseaza...
                </span>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-1.5" strokeWidth={2} />
                  Eliberat
                </>
              )}
            </button>
          </div>
          {person.release_date && (
            <p className="mt-2 text-xs text-emerald-700">
              Eliberat la {formatDate(person.release_date)}
            </p>
          )}
        </div>

        {/* Sentences Section */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Dosare Sentințe</h2>
            <Sheet open={sentenceFormOpen} onOpenChange={setSentenceFormOpen}>
              <SheetTrigger asChild>
                <button className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-md shadow-sm transition-colors">
                  <Plus className="h-4 w-4 mr-1.5" strokeWidth={2} />
                  Adaugă Sentință
                </button>
              </SheetTrigger>
              <SheetContent hideCloseButton className="flex flex-col p-0">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Adaugă Sentință</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Configurează detaliile sentinței</p>
                  </div>
                  <SheetClose asChild>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </SheetClose>
                </div>

                {/* Form Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 pb-32">
                  <div className="space-y-5">
                    {/* Crime Type */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                        Tip Infracțiune *
                      </label>
                      <Select
                        value={newSentence.crime_type}
                        onValueChange={(value) => setNewSentence({ ...newSentence, crime_type: value })}
                      >
                        <SelectTrigger className="w-full h-10 bg-white border border-gray-200 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-slate-500 focus:border-slate-500">
                          <SelectValue placeholder="Selectează tipul infracțiunii" />
                        </SelectTrigger>
                        <SelectContent>
                          {CRIME_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Crime Description */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                        Descriere
                      </label>
                      <textarea
                        value={newSentence.crime_description}
                        onChange={(e) => setNewSentence({ ...newSentence, crime_description: e.target.value })}
                        placeholder="Descriere suplimentară a infracțiunii..."
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 resize-none"
                      />
                    </div>

                    {/* Sentence Duration - Compact Grid */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                        Durată Pedeapsă *
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={newSentence.sentence_years}
                              onChange={(e) => setNewSentence({ ...newSentence, sentence_years: parseInt(e.target.value) || 0 })}
                              className="w-full h-10 px-3 pr-10 bg-white border border-gray-200 rounded-md text-center text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                              ani
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="11"
                              value={newSentence.sentence_months}
                              onChange={(e) => setNewSentence({ ...newSentence, sentence_months: parseInt(e.target.value) || 0 })}
                              className="w-full h-10 px-3 pr-11 bg-white border border-gray-200 rounded-md text-center text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                              luni
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="29"
                              value={newSentence.sentence_days}
                              onChange={(e) => setNewSentence({ ...newSentence, sentence_days: parseInt(e.target.value) || 0 })}
                              className="w-full h-10 px-3 pr-10 bg-white border border-gray-200 rounded-md text-center text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                              zile
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Start Date with Calendar Icon */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                        Data Începerii Executării *
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                        <DatePicker
                          date={sentenceStartDate}
                          onSelect={setSentenceStartDate}
                          placeholder="Selectează data"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                        Status Sentință
                      </label>
                      <Select
                        value={newSentence.status}
                        onValueChange={(value) => setNewSentence({ ...newSentence, status: value })}
                      >
                        <SelectTrigger className="w-full h-10 bg-white border border-gray-200 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-slate-500 focus:border-slate-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SENTENCE_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                        Note Adiționale
                      </label>
                      <textarea
                        value={newSentence.notes}
                        onChange={(e) => setNewSentence({ ...newSentence, notes: e.target.value })}
                        placeholder="Adaugă note sau observații..."
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer - Sticky Bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
                  <button
                    onClick={handleAddSentence}
                    disabled={isAddingSentence}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAddingSentence ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Se salvează...
                      </span>
                    ) : (
                      'Salvează Sentința'
                    )}
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {person.sentences.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-slate-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-medium text-slate-800 mb-1">Nicio sentință</h3>
              <p className="text-sm text-slate-500">Nu există sentințe înregistrate pentru această persoană</p>
            </div>
          ) : (
            <div className="space-y-5">
              {person.sentences.map((sentence) => (
                <SentenceCard
                  key={sentence.id}
                  sentence={sentence}
                  onAddReduction={handleOpenReductionForm}
                  onDeleteReduction={handleDeleteReduction}
                />
              ))}
            </div>
          )}
        </div>

        {/* Reduction Form Sheet */}
        <Sheet open={reductionFormOpen} onOpenChange={setReductionFormOpen}>
          <SheetContent hideCloseButton className="flex flex-col p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Adaugă Reducere Pedeapsă</h2>
                <p className="text-sm text-slate-500 mt-0.5">Conform articolelor legale aplicabile</p>
              </div>
              <SheetClose asChild>
                <button className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </SheetClose>
            </div>

            {/* Form Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 pb-32">
              <div className="space-y-5">
                {/* Applied Date with Calendar Icon - FIRST */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Data Aplicării *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                    <DatePicker
                      date={reductionDate}
                      onSelect={setReductionDate}
                      placeholder="Selectează data"
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Legal Article - Dropdown */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Articol Legal *
                  </label>
                  <Select
                    value={newReduction.legal_article}
                    onValueChange={(value) => setNewReduction({ ...newReduction, legal_article: value })}
                  >
                    <SelectTrigger className="w-full h-10 bg-white border border-gray-200 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-slate-500 focus:border-slate-500">
                      <SelectValue placeholder="Selectează articolul" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="473/4">Art. 473/4</SelectItem>
                      <SelectItem value="385">Art. 385</SelectItem>
                      <SelectItem value="107">Art. 107</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reduction Duration - Compact Grid */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Durată Reducere *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={newReduction.reduction_years}
                          onChange={(e) => setNewReduction({ ...newReduction, reduction_years: parseInt(e.target.value) || 0 })}
                          className="w-full h-10 px-3 pr-10 bg-white border border-gray-200 rounded-md text-center text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          ani
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="11"
                          value={newReduction.reduction_months}
                          onChange={(e) => setNewReduction({ ...newReduction, reduction_months: parseInt(e.target.value) || 0 })}
                          className="w-full h-10 px-3 pr-11 bg-white border border-gray-200 rounded-md text-center text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          luni
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="29"
                          value={newReduction.reduction_days}
                          onChange={(e) => setNewReduction({ ...newReduction, reduction_days: parseInt(e.target.value) || 0 })}
                          className="w-full h-10 px-3 pr-10 bg-white border border-gray-200 rounded-md text-center text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          zile
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Sticky Bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
              <button
                onClick={handleAddReduction}
                disabled={isAddingReduction || !newReduction.legal_article || !reductionDate}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingReduction ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Se salvează...
                  </span>
                ) : (
                  'Salvează Reducere'
                )}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  )
}
