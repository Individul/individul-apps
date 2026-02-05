'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, ChevronRight } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { personsApi, Person, PaginatedResponse } from '@/lib/api'
import { formatDate } from '@/lib/utils'

function getAlertBadge(alertStatus: string | null) {
  if (!alertStatus) return null

  switch (alertStatus) {
    case 'overdue':
      return <Badge variant="destructive">Depășit</Badge>
    case 'imminent':
      return <Badge variant="outline">≤ 30 zile</Badge>
    case 'upcoming':
      return <Badge className="bg-muted text-muted-foreground">30-90 zile</Badge>
    case 'fulfilled':
      return <Badge className="bg-secondary">Îndeplinit</Badge>
    default:
      return null
  }
}

export default function PersonsPage() {
  const router = useRouter()
  const [persons, setPersons] = useState<Person[]>([])
  const [searchQuery, setSearchQuery] = useState('')
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

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setIsLoading(true)
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Persoane Condamnate</h1>
            <p className="text-muted-foreground">{totalCount} persoane înregistrate</p>
          </div>
          <Button asChild>
            <Link href="/persons/new">
              <Plus className="h-4 w-4 mr-2" />
              Adaugă persoană
            </Link>
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Caută după nume sau CNP..."
                value={searchQuery}
                onChange={handleSearch}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Persons List */}
        <Card>
          <CardHeader>
            <CardTitle>Lista Persoanelor</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">Se încarcă...</p>
              </div>
            ) : persons.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-muted-foreground">Nu au fost găsite persoane</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/persons/new">Adaugă prima persoană</Link>
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {persons.map((person) => (
                    <Link
                      key={person.id}
                      href={`/persons/${person.id}`}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{person.full_name}</span>
                          {person.nearest_fraction_type && (
                            <Badge variant="outline" className="text-xs">
                              {person.nearest_fraction_type}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>CNP: {person.cnp}</span>
                          <span>Internat: {formatDate(person.admission_date)}</span>
                          <span>{person.active_sentences_count} sentințe active</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {person.nearest_fraction_date && (
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatDate(person.nearest_fraction_date)}</p>
                            <p className="text-xs text-muted-foreground">Următorul termen</p>
                          </div>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
