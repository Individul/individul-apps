'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { personsApi, ApiError, PersonCreate } from '@/lib/api'

export default function NewPersonPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<PersonCreate>({
    first_name: '',
    last_name: '',
    cnp: '',
    date_of_birth: '',
    admission_date: '',
    notes: '',
  })
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>()
  const [admissionDate, setAdmissionDate] = useState<Date | undefined>()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    // Validate CNP
    if (!/^\d{13}$/.test(formData.cnp)) {
      toast.error('CNP-ul trebuie să conțină exact 13 cifre')
      return
    }

    setIsLoading(true)

    try {
      const data = {
        ...formData,
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : '',
        admission_date: admissionDate ? admissionDate.toISOString().split('T')[0] : '',
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/persons">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Adaugă Persoană</h1>
            <p className="text-muted-foreground">Completează datele persoanei condamnate</p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Date Personale</CardTitle>
            <CardDescription>Informații de identificare a persoanei</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nume *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Introduceți numele"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prenume *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Introduceți prenumele"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnp">CNP *</Label>
                <Input
                  id="cnp"
                  value={formData.cnp}
                  onChange={(e) => setFormData({ ...formData, cnp: e.target.value.replace(/\D/g, '').slice(0, 13) })}
                  placeholder="Introduceți CNP-ul (13 cifre)"
                  required
                  disabled={isLoading}
                  maxLength={13}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.cnp.length}/13 cifre
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data Nașterii *</Label>
                  <DatePicker
                    date={dateOfBirth}
                    onSelect={setDateOfBirth}
                    placeholder="Selectează data nașterii"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Internării *</Label>
                  <DatePicker
                    date={admissionDate}
                    onSelect={setAdmissionDate}
                    placeholder="Selectează data internării"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Note adiționale (opțional)"
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Se salvează...' : 'Salvează'}
                </Button>
                <Button type="button" variant="outline" asChild disabled={isLoading}>
                  <Link href="/persons">Anulează</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
