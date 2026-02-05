'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Edit, Trash2, Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  personsApi,
  sentencesApi,
  PersonDetail,
  Sentence,
  Fraction,
  SentenceCreate,
  ApiError,
  CRIME_TYPES,
  SENTENCE_STATUSES,
} from '@/lib/api'
import { formatDate } from '@/lib/utils'

function getAlertBadge(alertStatus: string) {
  switch (alertStatus) {
    case 'overdue':
      return <Badge variant="destructive">Depășit</Badge>
    case 'imminent':
      return <Badge variant="outline">≤ 30 zile</Badge>
    case 'upcoming':
      return <Badge className="bg-muted text-muted-foreground">30-90 zile</Badge>
    case 'fulfilled':
      return <Badge className="bg-secondary">Îndeplinit</Badge>
    case 'distant':
      return <Badge className="bg-muted text-muted-foreground">&gt; 90 zile</Badge>
    default:
      return null
  }
}

export default function PersonDetailPage() {
  const router = useRouter()
  const params = useParams()
  const personId = params.id as string

  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingSentence, setIsAddingSentence] = useState(false)
  const [sentenceFormOpen, setSentenceFormOpen] = useState(false)

  // Sentence form state
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

  const fetchPerson = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const data = await personsApi.get(token, personId)
      setPerson(data)
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
        start_date: sentenceStartDate.toISOString().split('T')[0],
      })
      toast.success('Sentința a fost adăugată cu succes')
      setSentenceFormOpen(false)
      // Reset form
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
      // Refresh person data
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

  const handleMarkFractionFulfilled = async (sentenceId: string, fractionId: string) => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await sentencesApi.updateFraction(token, sentenceId, fractionId, {
        is_fulfilled: true,
        fulfilled_date: new Date().toISOString().split('T')[0],
      })
      toast.success('Fracția a fost marcată ca îndeplinită')
      fetchPerson()
    } catch (error) {
      toast.error('A apărut o eroare')
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Se încarcă...</p>
        </div>
      </AppLayout>
    )
  }

  if (!person) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground">Persoana nu a fost găsită</p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/persons">Înapoi la listă</Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/persons">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{person.full_name}</h1>
              <p className="text-muted-foreground">CNP: {person.cnp}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDeletePerson}>
              <Trash2 className="h-4 w-4 mr-2" />
              Șterge
            </Button>
          </div>
        </div>

        {/* Person Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informații Personale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Data nașterii</p>
                <p className="font-medium">{formatDate(person.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data internării</p>
                <p className="font-medium">{formatDate(person.admission_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sentințe active</p>
                <p className="font-medium">{person.active_sentences_count}</p>
              </div>
            </div>
            {person.notes && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Note</p>
                <p>{person.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="sentences">
          <TabsList>
            <TabsTrigger value="sentences">Sentințe ({person.sentences.length})</TabsTrigger>
            <TabsTrigger value="history">Istoric</TabsTrigger>
          </TabsList>

          <TabsContent value="sentences" className="space-y-4">
            {/* Add Sentence Button */}
            <div className="flex justify-end">
              <Sheet open={sentenceFormOpen} onOpenChange={setSentenceFormOpen}>
                <SheetTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Adaugă Sentință
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-lg overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Adaugă Sentință</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Tip Infracțiune *</Label>
                      <Select
                        value={newSentence.crime_type}
                        onValueChange={(value) => setNewSentence({ ...newSentence, crime_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selectează tipul" />
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

                    <div className="space-y-2">
                      <Label>Descriere (opțional)</Label>
                      <Input
                        value={newSentence.crime_description}
                        onChange={(e) => setNewSentence({ ...newSentence, crime_description: e.target.value })}
                        placeholder="Descriere suplimentară"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Durată Pedeapsă *</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Input
                            type="number"
                            min="0"
                            value={newSentence.sentence_years}
                            onChange={(e) => setNewSentence({ ...newSentence, sentence_years: parseInt(e.target.value) || 0 })}
                            placeholder="Ani"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Ani</p>
                        </div>
                        <div>
                          <Input
                            type="number"
                            min="0"
                            max="11"
                            value={newSentence.sentence_months}
                            onChange={(e) => setNewSentence({ ...newSentence, sentence_months: parseInt(e.target.value) || 0 })}
                            placeholder="Luni"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Luni</p>
                        </div>
                        <div>
                          <Input
                            type="number"
                            min="0"
                            max="29"
                            value={newSentence.sentence_days}
                            onChange={(e) => setNewSentence({ ...newSentence, sentence_days: parseInt(e.target.value) || 0 })}
                            placeholder="Zile"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Zile</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Data Începerii *</Label>
                      <DatePicker
                        date={sentenceStartDate}
                        onSelect={setSentenceStartDate}
                        placeholder="Selectează data"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={newSentence.status}
                        onValueChange={(value) => setNewSentence({ ...newSentence, status: value })}
                      >
                        <SelectTrigger>
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

                    <div className="space-y-2">
                      <Label>Note (opțional)</Label>
                      <Input
                        value={newSentence.notes}
                        onChange={(e) => setNewSentence({ ...newSentence, notes: e.target.value })}
                        placeholder="Note suplimentare"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleAddSentence}
                      disabled={isAddingSentence}
                    >
                      {isAddingSentence ? 'Se salvează...' : 'Salvează Sentința'}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Sentences List */}
            {person.sentences.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Nu există sentințe înregistrate</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {person.sentences.map((sentence) => (
                  <Card key={sentence.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{sentence.crime_type_display}</CardTitle>
                          <CardDescription>
                            {sentence.duration_display} • Începută la {formatDate(sentence.start_date)}
                          </CardDescription>
                        </div>
                        <Badge variant={sentence.status === 'active' ? 'default' : 'secondary'}>
                          {sentence.status_display}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Data sfârșit</p>
                          <p className="font-medium">{formatDate(sentence.end_date)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total zile</p>
                          <p className="font-medium">{sentence.total_days}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Infracțiune gravă</p>
                          <p className="font-medium">{sentence.is_serious_crime ? 'Da' : 'Nu'}</p>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Fractions */}
                      <div>
                        <h4 className="font-medium mb-3">Fracții</h4>
                        <div className="space-y-2">
                          {sentence.fractions.map((fraction) => (
                            <div
                              key={fraction.id}
                              className="flex items-center justify-between p-3 rounded-lg border"
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">{fraction.fraction_type}</Badge>
                                <div>
                                  <p className="font-medium">{formatDate(fraction.calculated_date)}</p>
                                  <p className="text-sm text-muted-foreground">{fraction.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getAlertBadge(fraction.alert_status)}
                                {!fraction.is_fulfilled && sentence.status === 'active' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMarkFractionFulfilled(sentence.id, fraction.id)}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Marchează
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Istoricul va fi implementat în curând</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
