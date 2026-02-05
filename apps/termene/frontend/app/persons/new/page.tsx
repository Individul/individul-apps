'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { DatePicker } from '@/components/ui/date-picker'
import { personsApi, ApiError, PersonCreate } from '@/lib/api'

export default function NewPersonPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<PersonCreate>({
    first_name: '',
    last_name: '',
    start_date: '',
    sentence_years: 0,
    sentence_months: 0,
    sentence_days: 0,
  })
  const [startDate, setStartDate] = useState<Date | undefined>()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    if (!startDate) {
      toast.error('Data începutului de termen este obligatorie')
      return
    }

    if (formData.sentence_years === 0 && formData.sentence_months === 0 && formData.sentence_days === 0) {
      toast.error('Pedeapsa trebuie să aibă cel puțin o zi')
      return
    }

    setIsLoading(true)

    try {
      const data = {
        ...formData,
        start_date: startDate ? startDate.toISOString().split('T')[0] : '',
      }

      const person = await personsApi.create(token, data)
      toast.success('Persoana a fost adăugată cu succes')
      router.push(`/persons/${person.id}`)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3 mb-8">
          <Link
            href="/persons"
            className="flex items-center justify-center w-9 h-9 rounded-md bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              Adaugă Persoană
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Completează datele persoanei condamnate
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          {/* Section Header */}
          <div className="px-6 pt-6 pb-4 mb-2 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-slate-800">Date Personale</h2>
            <p className="text-xs text-slate-500 mt-0.5">Informații de identificare</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 pb-6">
            {/* Name Fields */}
            <div className="grid gap-5 md:grid-cols-2 mb-5">
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1.5">
                  Nume
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Introduceți numele"
                  required
                  disabled={isLoading}
                  className="w-full h-10 px-3 bg-white border border-gray-200 rounded-md text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:opacity-50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1.5">
                  Prenume
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Introduceți prenumele"
                  required
                  disabled={isLoading}
                  className="w-full h-10 px-3 bg-white border border-gray-200 rounded-md text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:opacity-50 transition-colors"
                />
              </div>
            </div>

            {/* Start Date */}
            <div className="mb-5">
              <label className="block text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1.5">
                Început de Termen
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
                <DatePicker
                  date={startDate}
                  onSelect={setStartDate}
                  placeholder="Selectează data începutului de termen"
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Sentence Duration - Clean Grid */}
            <div className="mb-6">
              <label className="block text-xs uppercase tracking-wide font-semibold text-slate-500 mb-3">
                Durata Pedepsei
              </label>
              <div className="grid grid-cols-3 gap-4">
                {/* Years */}
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={formData.sentence_years}
                      onChange={(e) => setFormData({ ...formData, sentence_years: parseInt(e.target.value) || 0 })}
                      disabled={isLoading}
                      className="w-full h-12 px-3 pr-10 bg-white border border-gray-200 rounded-md text-center text-lg font-medium text-slate-800 tabular-nums focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:opacity-50 transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                      ani
                    </span>
                  </div>
                </div>

                {/* Months */}
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={11}
                      value={formData.sentence_months}
                      onChange={(e) => setFormData({ ...formData, sentence_months: parseInt(e.target.value) || 0 })}
                      disabled={isLoading}
                      className="w-full h-12 px-3 pr-12 bg-white border border-gray-200 rounded-md text-center text-lg font-medium text-slate-800 tabular-nums focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:opacity-50 transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                      luni
                    </span>
                  </div>
                </div>

                {/* Days */}
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={formData.sentence_days}
                      onChange={(e) => setFormData({ ...formData, sentence_days: parseInt(e.target.value) || 0 })}
                      disabled={isLoading}
                      className="w-full h-12 px-3 pr-10 bg-white border border-gray-200 rounded-md text-center text-lg font-medium text-slate-800 tabular-nums focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200 disabled:opacity-50 transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                      zile
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 pt-5 mt-6">
              {/* Actions - Aligned Right */}
              <div className="flex items-center justify-end gap-3">
                <Link
                  href="/persons"
                  className="inline-flex items-center h-10 px-4 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Anulează
                </Link>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center h-10 px-6 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Se salvează...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" strokeWidth={1.5} />
                      Salvează
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Info Note */}
        <p className="text-xs text-slate-500 mt-4 text-center">
          O sentință inițială va fi creată automat cu datele introduse.
        </p>
      </div>
    </AppLayout>
  )
}
