'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Clock, AlertCircle, X, Calendar, UserCheck, Pencil, ChevronDown } from 'lucide-react'
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
  PreventiveArrestCreate,
  ZPMCreate,
  ApiError,
  CRIME_TYPES,
  SENTENCE_STATUSES,
  RELEASE_TYPES,
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
    cumulated: 'bg-amber-50 text-amber-700 border-amber-200',
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    finished: 'bg-gray-100 text-gray-600 border-gray-300',
  }

  const labels: Record<string, string> = {
    active: 'Activă',
    cumulated: 'Cumulată',
    new: 'Nouă',
    finished: 'Finalizată',
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
  onAddPreventiveArrest,
  onDeletePreventiveArrest,
  onEditPreventiveArrest,
  onEditSentence,
  onAddZpm,
  onDeleteZpm,
}: {
  sentence: Sentence
  onAddReduction: (sentenceId: string) => void
  onDeleteReduction: (sentenceId: string, reductionId: string) => void
  onAddPreventiveArrest: (sentenceId: string) => void
  onDeletePreventiveArrest: (sentenceId: string, paId: string) => void
  onEditPreventiveArrest: (sentenceId: string, pa: any) => void
  onEditSentence: (sentence: Sentence) => void
  onAddZpm: (sentenceId: string) => void
  onDeleteZpm: (sentenceId: string, zpmId: string) => void
}) {
  const [reductionsExpanded, setReductionsExpanded] = useState(false)
  const [arrestExpanded, setArrestExpanded] = useState(false)
  const [zpmExpanded, setZpmExpanded] = useState(false)

  // Use effective_end_date if there are reductions, preventive arrests, or ZPM, otherwise use end_date
  const hasDeductions = (sentence.reductions && sentence.reductions.length > 0) || (sentence.preventive_arrests && sentence.preventive_arrests.length > 0) || (sentence.zpm_entries && sentence.zpm_entries.length > 0)
  const endDateToUse = hasDeductions
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
              {hasDeductions && (
                <span className="ml-2 text-amber-600">
                  (Efectiv: {sentence.effective_duration_display})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditSentence(sentence)}
              className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded transition-colors"
              title="Editează sentința"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onAddReduction(sentence.id)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
            >
              + Reducere
            </button>
            <button
              onClick={() => onAddPreventiveArrest(sentence.id)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
            >
              + Arest Prev.
            </button>
            <button
              onClick={() => onAddZpm(sentence.id)}
              className="text-xs text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-2 py-1 rounded transition-colors"
            >
              + ZPM
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
            {hasDeductions ? (
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
          <span className="text-xs uppercase text-gray-400 font-semibold">Data</span>
          <span className="text-xs uppercase text-gray-400 font-semibold">Zile</span>
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

            {/* Date */}
            <span className="text-sm font-mono text-slate-700 tabular-nums">
              {formatDate(fraction.calculated_date)}
            </span>

            {/* Days Until */}
            <span className={`text-sm font-medium ${fraction.days_until < 0 ? 'text-red-600' : 'text-slate-600'}`}>
              {fraction.is_fulfilled ? '—' : fraction.days_until < 0 ? `${Math.abs(fraction.days_until)} depășite` : `${fraction.days_until} rămase`}
            </span>

            {/* Status Badge */}
            <FractionStatusBadge status={fraction.alert_status} isFulfilled={fraction.is_fulfilled} />
          </div>
        ))}
      </div>

      {/* Reductions Section */}
      {sentence.reductions && sentence.reductions.length > 0 && (
        <div className="border-t border-gray-100 bg-amber-50/50">
          <button
            onClick={() => setReductionsExpanded(!reductionsExpanded)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-amber-50/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`h-3.5 w-3.5 text-amber-500 transition-transform ${reductionsExpanded ? '' : '-rotate-90'}`} />
              <span className="text-xs uppercase text-amber-700 font-semibold">Reduceri Aplicate</span>
              <span className="text-xs text-amber-500">({sentence.reductions.length})</span>
            </div>
            <span className="text-xs text-amber-600 font-medium">
              Total: -{sentence.total_reduction_days} zile
            </span>
          </button>
          {reductionsExpanded && sentence.reductions.map((reduction, index) => (
            <div
              key={reduction.id}
              className={`flex items-center justify-between px-5 py-2.5 border-t border-amber-100/50 ${
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

      {/* Arest Preventiv Section */}
      {sentence.preventive_arrests && sentence.preventive_arrests.length > 0 && (
        <div className="border-t border-gray-100 bg-blue-50/50">
          <button
            onClick={() => setArrestExpanded(!arrestExpanded)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-blue-50/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`h-3.5 w-3.5 text-blue-500 transition-transform ${arrestExpanded ? '' : '-rotate-90'}`} />
              <span className="text-xs uppercase text-blue-700 font-semibold tracking-wider">Arest Preventiv</span>
              <span className="text-xs text-blue-500">({sentence.preventive_arrests.length})</span>
            </div>
            <span className="text-xs text-blue-600 font-medium">
              Total: -{sentence.total_preventive_arrest_days} zile
            </span>
          </button>
          {arrestExpanded && sentence.preventive_arrests.map((pa: any, index: number) => (
            <div
              key={pa.id}
              className={`flex items-center justify-between px-5 py-2.5 border-t border-blue-100/50 ${
                index < sentence.preventive_arrests.length - 1 ? 'border-b border-blue-100/50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 font-mono text-xs rounded">
                  AP
                </span>
                <span className="text-sm text-blue-700">
                  {formatDate(pa.start_date)} — {formatDate(pa.end_date)}
                </span>
                <span className="text-xs text-blue-500">
                  ({pa.days} zile)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEditPreventiveArrest(sentence.id, pa)}
                  className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                  title="Editează arestul preventiv"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <button
                  onClick={() => onDeletePreventiveArrest(sentence.id, pa.id)}
                  className="p-1 text-blue-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Șterge arestul preventiv"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ZPM Section */}
      {sentence.zpm_entries && sentence.zpm_entries.length > 0 && (
        <div className="border-t border-gray-100 bg-teal-50/50">
          <button
            onClick={() => setZpmExpanded(!zpmExpanded)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-teal-50/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={`h-3.5 w-3.5 text-teal-500 transition-transform ${zpmExpanded ? '' : '-rotate-90'}`} />
              <span className="text-xs uppercase text-teal-700 font-semibold tracking-wider">ZPM - Zile Privilegiate</span>
              <span className="text-xs text-teal-500">({sentence.zpm_entries.length})</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-teal-600 font-medium tabular-nums">
                Total: {sentence.total_zpm_days_raw?.toFixed(2)} zile
              </span>
              <span className="text-xs text-teal-700 font-semibold tabular-nums">
                Aplicat: -{sentence.total_zpm_days} zile
              </span>
            </div>
          </button>
          {zpmExpanded && sentence.zpm_entries.map((zpm: any, index: number) => (
            <div
              key={zpm.id}
              className={`flex items-center justify-between px-5 py-2.5 border-t border-teal-100/50 ${
                index < sentence.zpm_entries.length - 1 ? 'border-b border-teal-100/50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-1 bg-teal-100 text-teal-800 font-mono text-xs rounded">
                  {zpm.month_display}
                </span>
                <span className="text-sm text-teal-700 tabular-nums">
                  {Number(zpm.days).toFixed(2)} zile
                </span>
              </div>
              <button
                onClick={() => onDeleteZpm(sentence.id, zpm.id)}
                className="p-1 text-teal-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Șterge ZPM"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
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
  const [releaseType, setReleaseType] = useState('')
  const [isReleasing, setIsReleasing] = useState(false)

  // Preventive arrest form state
  const [paFormOpen, setPaFormOpen] = useState(false)
  const [selectedSentenceForPa, setSelectedSentenceForPa] = useState<string | null>(null)
  const [isAddingPa, setIsAddingPa] = useState(false)
  const [paStartDate, setPaStartDate] = useState<Date | undefined>()
  const [paEndDate, setPaEndDate] = useState<Date | undefined>()

  // Edit preventive arrest form state
  const [editPaFormOpen, setEditPaFormOpen] = useState(false)
  const [selectedSentenceForEditPa, setSelectedSentenceForEditPa] = useState<string | null>(null)
  const [selectedPaId, setSelectedPaId] = useState<string | null>(null)
  const [isEditingPa, setIsEditingPa] = useState(false)
  const [editPaStartDate, setEditPaStartDate] = useState<Date | undefined>()
  const [editPaEndDate, setEditPaEndDate] = useState<Date | undefined>()

  // Edit person form state
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    first_name: '',
    last_name: '',
  })

  // Edit sentence form state
  const [editSentenceFormOpen, setEditSentenceFormOpen] = useState(false)
  const [isEditingSentence, setIsEditingSentence] = useState(false)
  const [selectedSentenceForEdit, setSelectedSentenceForEdit] = useState<string | null>(null)
  const [editSentenceData, setEditSentenceData] = useState({
    sentence_years: 0,
    sentence_months: 0,
    sentence_days: 0,
    status: 'active',
  })
  const [editSentenceStartDate, setEditSentenceStartDate] = useState<Date | undefined>()

  // ZPM form state
  const [zpmFormOpen, setZpmFormOpen] = useState(false)
  const [selectedSentenceForZpm, setSelectedSentenceForZpm] = useState<string | null>(null)
  const [isAddingZpm, setIsAddingZpm] = useState(false)
  const [zpmMonth, setZpmMonth] = useState<string>('')
  const [zpmYear, setZpmYear] = useState<number>(new Date().getFullYear())
  const [zpmDays, setZpmDays] = useState<string>('')

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
      setReleaseType(data.release_type || '')
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

  const handleOpenEditForm = () => {
    if (person) {
      setEditData({
        first_name: person.first_name,
        last_name: person.last_name,
      })
      setEditFormOpen(true)
    }
  }

  const handleEditPerson = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    if (!editData.first_name.trim() || !editData.last_name.trim()) {
      toast.error('Numele și prenumele sunt obligatorii')
      return
    }

    setIsEditing(true)
    try {
      await personsApi.update(token, personId, {
        first_name: editData.first_name.trim(),
        last_name: editData.last_name.trim(),
      })
      toast.success('Datele au fost actualizate cu succes')
      setEditFormOpen(false)
      fetchPerson()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare la actualizare')
      }
    } finally {
      setIsEditing(false)
    }
  }

  const handleOpenEditSentenceForm = (sentence: Sentence) => {
    setSelectedSentenceForEdit(sentence.id)
    setEditSentenceData({
      sentence_years: sentence.sentence_years,
      sentence_months: sentence.sentence_months,
      sentence_days: sentence.sentence_days,
      status: sentence.status,
    })
    setEditSentenceStartDate(parseApiDate(sentence.start_date))
    setEditSentenceFormOpen(true)
  }

  const handleEditSentence = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !selectedSentenceForEdit) return

    if (!editSentenceStartDate) {
      toast.error('Data începutului de termen este obligatorie')
      return
    }

    if (editSentenceData.sentence_years === 0 && editSentenceData.sentence_months === 0 && editSentenceData.sentence_days === 0) {
      toast.error('Pedeapsa trebuie să aibă cel puțin o zi')
      return
    }

    setIsEditingSentence(true)
    try {
      await sentencesApi.update(token, selectedSentenceForEdit, {
        sentence_years: editSentenceData.sentence_years,
        sentence_months: editSentenceData.sentence_months,
        sentence_days: editSentenceData.sentence_days,
        start_date: formatDateForApi(editSentenceStartDate),
        status: editSentenceData.status,
      })
      toast.success('Sentința a fost actualizată cu succes')
      setEditSentenceFormOpen(false)
      fetchPerson()
    } catch (error: any) {
      console.error('Sentence update error:', error)
      if (error instanceof ApiError) {
        // Extract field-level errors from backend response
        const data = error.data
        if (data && typeof data === 'object' && !data.detail && !data.message) {
          const messages: string[] = []
          for (const [, value] of Object.entries(data)) {
            if (Array.isArray(value)) {
              messages.push(...value.map(String))
            } else if (typeof value === 'string') {
              messages.push(value)
            }
          }
          toast.error(messages.length > 0 ? messages.join('. ') : error.message)
        } else {
          toast.error(error.message)
        }
      } else {
        toast.error('A apărut o eroare la actualizare')
      }
    } finally {
      setIsEditingSentence(false)
    }
  }

  const handleReleasePerson = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    if (!releaseDate) {
      toast.error('Selectează data eliberării')
      return
    }

    if (!releaseType) {
      toast.error('Selectează modalitatea eliberării')
      return
    }

    if (!confirm('Confirmați marcarea persoanei ca eliberată?')) {
      return
    }

    setIsReleasing(true)
    try {
      const response = await personsApi.release(token, personId, {
        release_date: formatDateForApi(releaseDate),
        release_type: releaseType,
      })
      setPerson(response.person)
      setReleaseDate(parseApiDate(response.person.release_date) || releaseDate)
      setReleaseType(response.person.release_type || '')
      toast.success('Persoana a fost marcată ca eliberată')
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

  const handleOpenPaForm = (sentenceId: string) => {
    setSelectedSentenceForPa(sentenceId)
    setPaStartDate(undefined)
    setPaEndDate(undefined)
    setPaFormOpen(true)
  }

  const handleAddPreventiveArrest = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !selectedSentenceForPa) return

    if (!paStartDate || !paEndDate) {
      toast.error('Completați ambele date')
      return
    }

    setIsAddingPa(true)
    try {
      await sentencesApi.addPreventiveArrest(token, selectedSentenceForPa, {
        start_date: formatDateForApi(paStartDate),
        end_date: formatDateForApi(paEndDate),
      })
      toast.success('Arestul preventiv a fost adăugat')
      setPaFormOpen(false)
      fetchPerson()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare')
      }
    } finally {
      setIsAddingPa(false)
    }
  }

  const handleDeletePreventiveArrest = async (sentenceId: string, paId: string) => {
    if (!confirm('Sigur doriți să ștergeți această perioadă de arest preventiv?')) return
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await sentencesApi.deletePreventiveArrest(token, sentenceId, paId)
      toast.success('Arestul preventiv a fost șters')
      fetchPerson()
    } catch (error) {
      toast.error('A apărut o eroare la ștergere')
    }
  }

  const handleOpenZpmForm = (sentenceId: string) => {
    setSelectedSentenceForZpm(sentenceId)
    setZpmMonth('')
    setZpmYear(new Date().getFullYear())
    setZpmDays('')
    setZpmFormOpen(true)
  }

  const handleAddZpm = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !selectedSentenceForZpm) return

    if (!zpmMonth || !zpmDays) {
      toast.error('Completează luna și numărul de zile')
      return
    }

    const daysValue = parseFloat(zpmDays)
    if (isNaN(daysValue) || daysValue <= 0) {
      toast.error('Numărul de zile trebuie să fie mai mare decât 0')
      return
    }

    setIsAddingZpm(true)
    try {
      await sentencesApi.addZpm(token, selectedSentenceForZpm, {
        month: parseInt(zpmMonth),
        year: zpmYear,
        days: daysValue,
      })
      toast.success('ZPM a fost adăugat')
      setZpmFormOpen(false)
      fetchPerson()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare')
      }
    } finally {
      setIsAddingZpm(false)
    }
  }

  const handleDeleteZpm = async (sentenceId: string, zpmId: string) => {
    if (!confirm('Sigur doriți să ștergeți acest ZPM?')) return
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await sentencesApi.deleteZpm(token, sentenceId, zpmId)
      toast.success('ZPM a fost șters')
      fetchPerson()
    } catch (error) {
      toast.error('A apărut o eroare la ștergerea ZPM')
    }
  }

  const handleOpenEditPaForm = (sentenceId: string, pa: any) => {
    setSelectedSentenceForEditPa(sentenceId)
    setSelectedPaId(pa.id)
    setEditPaStartDate(parseApiDate(pa.start_date))
    setEditPaEndDate(parseApiDate(pa.end_date))
    setEditPaFormOpen(true)
  }

  const handleEditPreventiveArrest = async () => {
    const token = localStorage.getItem('access_token')
    if (!token || !selectedSentenceForEditPa || !selectedPaId) return

    if (!editPaStartDate || !editPaEndDate) {
      toast.error('Completați ambele date')
      return
    }

    setIsEditingPa(true)
    try {
      await sentencesApi.updatePreventiveArrest(token, selectedSentenceForEditPa, selectedPaId, {
        start_date: formatDateForApi(editPaStartDate),
        end_date: formatDateForApi(editPaEndDate),
      })
      toast.success('Arestul preventiv a fost actualizat')
      setEditPaFormOpen(false)
      fetchPerson()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare la actualizare')
      }
    } finally {
      setIsEditingPa(false)
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenEditForm}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-gray-200 transition-colors"
            >
              <Pencil className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
              Editează
            </button>
            <button
              onClick={handleDeletePerson}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md border border-gray-200 transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
              Șterge
            </button>
          </div>
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
                Data eliberării
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                <DatePicker
                  date={releaseDate}
                  onSelect={setReleaseDate}
                  placeholder="Selectează data eliberării"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                Modalitatea eliberării
              </label>
              <Select value={releaseType} onValueChange={setReleaseType}>
                <SelectTrigger className="w-full h-10 bg-white border border-gray-200 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-slate-500 focus:border-slate-500">
                  <SelectValue placeholder="Selectează modalitatea" />
                </SelectTrigger>
                <SelectContent>
                  {RELEASE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              onClick={handleReleasePerson}
              disabled={!releaseDate || !releaseType || isReleasing}
              className="inline-flex items-center justify-center px-4 h-10 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReleasing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Se procesează...
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
              {person.release_type && ` — ${RELEASE_TYPES.find(t => t.value === person.release_type)?.label || person.release_type}`}
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
                  onAddPreventiveArrest={handleOpenPaForm}
                  onDeletePreventiveArrest={handleDeletePreventiveArrest}
                  onEditPreventiveArrest={handleOpenEditPaForm}
                  onEditSentence={handleOpenEditSentenceForm}
                  onAddZpm={handleOpenZpmForm}
                  onDeleteZpm={handleDeleteZpm}
                />
              ))}
            </div>
          )}
        </div>

        {/* Edit Person Sheet */}
        <Sheet open={editFormOpen} onOpenChange={setEditFormOpen}>
          <SheetContent hideCloseButton className="flex flex-col p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Editează Persoana</h2>
                <p className="text-sm text-slate-500 mt-0.5">Modifică datele personale</p>
              </div>
              <SheetClose asChild>
                <button className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </SheetClose>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-6 pb-32">
              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Nume *
                  </label>
                  <input
                    type="text"
                    value={editData.last_name}
                    onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                    placeholder="Introduceți numele"
                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-md text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Prenume *
                  </label>
                  <input
                    type="text"
                    value={editData.first_name}
                    onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                    placeholder="Introduceți prenumele"
                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-md text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
              <button
                onClick={handleEditPerson}
                disabled={isEditing}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Se salvează...
                  </span>
                ) : (
                  'Salvează Modificările'
                )}
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Edit Sentence Sheet */}
        <Sheet open={editSentenceFormOpen} onOpenChange={setEditSentenceFormOpen}>
          <SheetContent hideCloseButton className="flex flex-col p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Editează Sentința</h2>
                <p className="text-sm text-slate-500 mt-0.5">Modifică durata, începutul termenului și statusul</p>
              </div>
              <SheetClose asChild>
                <button className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </SheetClose>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-6 pb-32">
              <div className="space-y-5">
                {/* Start Date */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Început de Termen *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                    <DatePicker
                      date={editSentenceStartDate}
                      onSelect={setEditSentenceStartDate}
                      placeholder="Selectează data"
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Sentence Duration */}
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
                          value={editSentenceData.sentence_years}
                          onChange={(e) => setEditSentenceData({ ...editSentenceData, sentence_years: parseInt(e.target.value) || 0 })}
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
                          value={editSentenceData.sentence_months}
                          onChange={(e) => setEditSentenceData({ ...editSentenceData, sentence_months: parseInt(e.target.value) || 0 })}
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
                          value={editSentenceData.sentence_days}
                          onChange={(e) => setEditSentenceData({ ...editSentenceData, sentence_days: parseInt(e.target.value) || 0 })}
                          className="w-full h-10 px-3 pr-10 bg-white border border-gray-200 rounded-md text-center text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          zile
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Status Sentință
                  </label>
                  <Select
                    value={editSentenceData.status}
                    onValueChange={(value) => setEditSentenceData({ ...editSentenceData, status: value })}
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
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
              <button
                onClick={handleEditSentence}
                disabled={isEditingSentence}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditingSentence ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Se salvează...
                  </span>
                ) : (
                  'Salvează Modificările'
                )}
              </button>
            </div>
          </SheetContent>
        </Sheet>

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

        {/* Preventive Arrest Form Sheet */}
        <Sheet open={paFormOpen} onOpenChange={setPaFormOpen}>
          <SheetContent hideCloseButton className="flex flex-col p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Adaugă Arest Preventiv</h2>
                <p className="text-sm text-slate-500 mt-0.5">Perioada de detenție anterioară executării pedepsei</p>
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
                {/* Start Date */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Data Început *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                    <DatePicker
                      date={paStartDate}
                      onSelect={setPaStartDate}
                      placeholder="Selectează data"
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Data Sfârșit *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                    <DatePicker
                      date={paEndDate}
                      onSelect={setPaEndDate}
                      placeholder="Selectează data"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Sticky Bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
              <button
                onClick={handleAddPreventiveArrest}
                disabled={isAddingPa || !paStartDate || !paEndDate}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingPa ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Se salvează...
                  </span>
                ) : (
                  'Salvează'
                )}
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Edit Preventive Arrest Sheet */}
        <Sheet open={editPaFormOpen} onOpenChange={setEditPaFormOpen}>
          <SheetContent hideCloseButton className="flex flex-col p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Editează Arest Preventiv</h2>
                <p className="text-sm text-slate-500 mt-0.5">Modifică perioada de arest preventiv</p>
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
                {/* Start Date */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Data Început *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                    <DatePicker
                      date={editPaStartDate}
                      onSelect={setEditPaStartDate}
                      placeholder="Selectează data"
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Data Sfârșit *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                    <DatePicker
                      date={editPaEndDate}
                      onSelect={setEditPaEndDate}
                      placeholder="Selectează data"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Sticky Bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
              <button
                onClick={handleEditPreventiveArrest}
                disabled={isEditingPa || !editPaStartDate || !editPaEndDate}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditingPa ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Se salvează...
                  </span>
                ) : (
                  'Salvează Modificările'
                )}
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* ZPM Form Sheet */}
        <Sheet open={zpmFormOpen} onOpenChange={setZpmFormOpen}>
          <SheetContent hideCloseButton className="flex flex-col p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Adaugă ZPM</h2>
                <p className="text-sm text-slate-500 mt-0.5">Zile privilegiate de muncă pentru luna selectată</p>
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
                {/* Month */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Luna *
                  </label>
                  <Select
                    value={zpmMonth}
                    onValueChange={setZpmMonth}
                  >
                    <SelectTrigger className="w-full h-10 bg-white border border-gray-200 rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-slate-500 focus:border-slate-500">
                      <SelectValue placeholder="Selectează luna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Ianuarie</SelectItem>
                      <SelectItem value="2">Februarie</SelectItem>
                      <SelectItem value="3">Martie</SelectItem>
                      <SelectItem value="4">Aprilie</SelectItem>
                      <SelectItem value="5">Mai</SelectItem>
                      <SelectItem value="6">Iunie</SelectItem>
                      <SelectItem value="7">Iulie</SelectItem>
                      <SelectItem value="8">August</SelectItem>
                      <SelectItem value="9">Septembrie</SelectItem>
                      <SelectItem value="10">Octombrie</SelectItem>
                      <SelectItem value="11">Noiembrie</SelectItem>
                      <SelectItem value="12">Decembrie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Anul *
                  </label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={zpmYear}
                    onChange={(e) => setZpmYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-md text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>

                {/* Days */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
                    Zile Lucrate *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max="31"
                    step="0.01"
                    value={zpmDays}
                    onChange={(e) => setZpmDays(e.target.value)}
                    placeholder="ex: 1.11"
                    className="w-full h-10 px-3 bg-white border border-gray-200 rounded-md text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer - Sticky Bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
              <button
                onClick={handleAddZpm}
                disabled={isAddingZpm || !zpmMonth || !zpmDays}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingZpm ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Se salvează...
                  </span>
                ) : (
                  'Salvează ZPM'
                )}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  )
}
