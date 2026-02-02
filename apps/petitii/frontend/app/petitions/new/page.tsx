'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppLayout } from '@/components/layout/app-layout'
import { petitionsApi, ApiError } from '@/lib/api'

const petitionerTypes = [
  { value: 'condamnat', label: 'Condamnat' },
  { value: 'ruda', label: 'Rudă' },
  { value: 'avocat', label: 'Avocat' },
  { value: 'organ_stat', label: 'Organ de stat' },
  { value: 'altul', label: 'Altul' },
]

const objectTypes = [
  { value: 'art_91', label: 'Art. 91 (Liberare condiționată)' },
  { value: 'art_92', label: 'Art. 92 (Întreruperea executării)' },
  { value: 'amnistie', label: 'Amnistie' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'executare', label: 'Executarea pedepsei' },
  { value: 'copii_dosar', label: 'Copii dosar' },
  { value: 'copii_acte', label: 'Copii acte' },
  { value: 'altele', label: 'Altele' },
]

const formSchema = z.object({
  registration_prefix: z.string().default('P'),
  registration_date: z.string().optional(),
  petitioner_type: z.string().min(1, 'Selectați tipul petiționar'),
  petitioner_name: z.string().min(1, 'Introduceți numele petiționar'),
  detainee_fullname: z.string().optional(),
  object_type: z.string().min(1, 'Selectați tipul obiect'),
  object_description: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export default function NewPetitionPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      registration_prefix: 'P',
      registration_date: new Date().toISOString().split('T')[0],
    },
  })

  const onSubmit = async (data: FormData) => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    setIsSubmitting(true)
    try {
      const petition = await petitionsApi.create(token, data)
      toast.success('Petiția a fost înregistrată cu succes')
      router.push(`/petitii/petitions/${petition.id}`)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error('A apărut o eroare la salvare')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/petitions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold">Înregistrare petiție nouă</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Date petiție</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Registration info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="registration_prefix">Prefix</Label>
                  <Input
                    id="registration_prefix"
                    {...register('registration_prefix')}
                    placeholder="P"
                    maxLength={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registration_date">Data înregistrării</Label>
                  <Input
                    id="registration_date"
                    type="date"
                    {...register('registration_date')}
                  />
                </div>
              </div>

              {/* Petitioner info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tip petiționar *</Label>
                  <Select
                    value={watch('petitioner_type')}
                    onValueChange={(value) => setValue('petitioner_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectați tipul petiționar" />
                    </SelectTrigger>
                    <SelectContent>
                      {petitionerTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.petitioner_type && (
                    <p className="text-sm text-destructive">{errors.petitioner_type.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="petitioner_name">Nume petiționar *</Label>
                  <Input
                    id="petitioner_name"
                    {...register('petitioner_name')}
                    placeholder="Numele complet al petiționar"
                  />
                  {errors.petitioner_name && (
                    <p className="text-sm text-destructive">{errors.petitioner_name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="detainee_fullname">Nume deținut (opțional)</Label>
                  <Input
                    id="detainee_fullname"
                    {...register('detainee_fullname')}
                    placeholder="Numele complet al deținutului"
                  />
                </div>
              </div>

              {/* Object info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tip obiect *</Label>
                  <Select
                    value={watch('object_type')}
                    onValueChange={(value) => setValue('object_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectați tipul obiect" />
                    </SelectTrigger>
                    <SelectContent>
                      {objectTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.object_type && (
                    <p className="text-sm text-destructive">{errors.object_type.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="object_description">Descriere obiect (opțional)</Label>
                  <Textarea
                    id="object_description"
                    {...register('object_description')}
                    placeholder="Detalii suplimentare despre obiectul petiției"
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <Link href="/petitions">
                  <Button type="button" variant="outline">
                    Anulare
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Se salvează...
                    </>
                  ) : (
                    'Înregistrare petiție'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
