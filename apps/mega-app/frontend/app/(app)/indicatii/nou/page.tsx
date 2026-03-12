'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { TaskUser, Person, SablonIndicatie, indicatiiApi, sabloaneApi, tasksApi } from '@/lib/api'
import { useUserRole } from '@/lib/use-user-role'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Loader2,
  Save,
  Check,
  FileText,
  X,
  Search,
  Users,
} from 'lucide-react'

export default function IndicatieNouaPage() {
  const router = useRouter()
  const { isViewer } = useUserRole()
  const [users, setUsers] = useState<TaskUser[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)

  // Sabloane
  const [sabloane, setSabloane] = useState<SablonIndicatie[]>([])
  const [loadingSabloane, setLoadingSabloane] = useState(true)
  const [selectedSablon, setSelectedSablon] = useState<string>('')
  const [saveAsSablon, setSaveAsSablon] = useState(false)
  const [numeSablon, setNumeSablon] = useState('')

  // Form state
  const [titlu, setTitlu] = useState('')
  const [descriere, setDescriere] = useState('')
  const [prioritate, setPrioritate] = useState<string>('NORMAL')
  const [termenLimita, setTermenLimita] = useState('')
  const [selectedDestinatari, setSelectedDestinatari] = useState<number[]>([])

  // Instanta
  const [instanta, setInstanta] = useState('')

  // Hotarire
  const [tipHotarire, setTipHotarire] = useState('')
  const [dataHotarire, setDataHotarire] = useState('')

  // Multi-person select
  const [personSearch, setPersonSearch] = useState('')
  const [personResults, setPersonResults] = useState<Person[]>([])
  const [selectedPersons, setSelectedPersons] = useState<Person[]>([])
  const [searchingPersons, setSearchingPersons] = useState(false)
  const [showPersonDropdown, setShowPersonDropdown] = useState(false)

  useEffect(() => {
    if (isViewer) {
      router.push('/indicatii')
      return
    }
    const token = localStorage.getItem('access_token')
    if (!token) return

    setLoadingUsers(true)
    tasksApi.users(token)
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoadingUsers(false))

    setLoadingSabloane(true)
    sabloaneApi.list(token)
      .then(setSabloane)
      .catch(console.error)
      .finally(() => setLoadingSabloane(false))
  }, [isViewer, router])

  // Person search with debounce
  useEffect(() => {
    if (personSearch.length < 2) {
      setPersonResults([])
      setShowPersonDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      const token = localStorage.getItem('access_token')
      if (!token) return
      setSearchingPersons(true)
      try {
        const response = await indicatiiApi.personsSearch(token, personSearch)
        const results = response.results || []
        // Filter out already selected persons
        const filtered = results.filter(
          (p: Person) => !selectedPersons.some(sp => sp.id === p.id)
        )
        setPersonResults(filtered)
        setShowPersonDropdown(true)
      } catch (error) {
        console.error('Person search failed:', error)
      } finally {
        setSearchingPersons(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [personSearch, selectedPersons])

  function handleSablonSelect(sablonId: string) {
    setSelectedSablon(sablonId)
    if (sablonId === 'none') {
      return
    }
    const sablon = sabloane.find(s => s.id === sablonId)
    if (sablon) {
      setTitlu(sablon.titlu)
      setDescriere(sablon.descriere)
      setPrioritate(sablon.prioritate)
      setInstanta(sablon.instanta || '')
      setTipHotarire(sablon.tip_hotarire || '')
      setDataHotarire(sablon.data_hotarire || '')
      // Pre-select destinatari from template
      const destIds = sablon.destinatari_default_details.map(d => Number(d.id))
      setSelectedDestinatari(destIds)
    }
  }

  function toggleDestinatar(userId: number) {
    setSelectedDestinatari(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  function addPerson(person: Person) {
    setSelectedPersons(prev => [...prev, person])
    setPersonSearch('')
    setPersonResults([])
    setShowPersonDropdown(false)
  }

  function removePerson(personId: string) {
    setSelectedPersons(prev => prev.filter(p => p.id !== personId))
  }

  function buildHotarireLine(): string {
    const tip = tipHotarire && tipHotarire !== 'none' ? tipHotarire : ''
    const inst = instanta && instanta !== 'none' ? instanta : ''
    const data = dataHotarire || ''

    if (!tip && !inst && !data) return ''

    let line = ''
    if (tip) line += tip
    if (inst) line += (line ? ' Judecătoriei ' : '') + inst
    if (data) {
      const [y, m, d] = data.split('-')
      line += (line ? ' din ' : '') + `${d}.${m}.${y}`
    }
    return line
  }

  async function handleSave() {
    if (!titlu.trim()) return
    // destinatari is optional
    setSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) return

      // Build hotarire line and prepend to descriere
      const hotarireLine = buildHotarireLine()
      const finalDescriere = hotarireLine
        ? (descriere.trim() ? hotarireLine + '\n' + descriere.trim() : hotarireLine)
        : descriere.trim()

      // Save as template if checked
      if (saveAsSablon && numeSablon.trim()) {
        await sabloaneApi.create(token, {
          nume: numeSablon.trim(),
          titlu: titlu.trim(),
          descriere: finalDescriere,
          prioritate,
          instanta: instanta === 'none' ? '' : instanta,
          tip_hotarire: tipHotarire === 'none' ? '' : tipHotarire,
          data_hotarire: dataHotarire || null,
          destinatari_default_ids: selectedDestinatari,
        })
      }

      if (selectedPersons.length > 1) {
        // Bulk create - one indicatie per person
        await indicatiiApi.bulkCreate(token, {
          titlu: titlu.trim(),
          descriere: finalDescriere,
          prioritate,
          instanta: instanta === 'none' ? '' : instanta,
          tip_hotarire: tipHotarire === 'none' ? '' : tipHotarire,
          data_hotarire: dataHotarire || null,
          destinatari_ids: selectedDestinatari,
          termen_limita: termenLimita || null,
          persoane_ids: selectedPersons.map(p => p.id),
        })
      } else {
        // Single create
        await indicatiiApi.create(token, {
          titlu: titlu.trim(),
          descriere: finalDescriere,
          prioritate,
          instanta: instanta === 'none' ? '' : instanta,
          tip_hotarire: tipHotarire === 'none' ? '' : tipHotarire,
          data_hotarire: dataHotarire || null,
          termen_limita: termenLimita || null,
          destinatari_ids: selectedDestinatari,
          persoana_legata: selectedPersons.length === 1 ? selectedPersons[0].id : null,
        })
      }
      router.push('/indicatii')
    } catch (error) {
      console.error('Failed to create indicatie:', error)
    } finally {
      setSaving(false)
    }
  }

  if (isViewer) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/indicatii">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Inapoi
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="font-semibold">Sarcina noua</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/indicatii">
            <Button variant="outline">Anuleaza</Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={saving || !titlu.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {selectedPersons.length > 1
              ? `Salveaza (${selectedPersons.length} sarcini)`
              : 'Salveaza'}
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Sablon selector */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sablon (optional)
          </Label>
          {loadingSabloane ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Se incarca sabloanele...
            </div>
          ) : sabloane.length > 0 ? (
            <Select value={selectedSablon} onValueChange={handleSablonSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteaza un sablon..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Fara sablon --</SelectItem>
                {sabloane.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nume}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">Nu exista sabloane salvate.</p>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="titlu">Titlu *</Label>
          <Input
            id="titlu"
            value={titlu}
            onChange={(e) => setTitlu(e.target.value)}
            placeholder="Titlul sarcinii"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descriere">Descriere</Label>
          <Textarea
            id="descriere"
            value={descriere}
            onChange={(e) => setDescriere(e.target.value)}
            placeholder="Descrierea sarcinii"
            className="min-h-[100px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Prioritate</Label>
            <Select value={prioritate} onValueChange={setPrioritate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="SCAZUT">Scazut</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="termen">Termen limita</Label>
            <Input
              id="termen"
              type="date"
              value={termenLimita}
              onChange={(e) => setTermenLimita(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Instanta de judecata</Label>
          <Select value={instanta} onValueChange={setInstanta}>
            <SelectTrigger>
              <SelectValue placeholder="Selecteaza instanta..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Fara instanta --</SelectItem>
              <SelectItem value="Chișinău sediul Central (Botanica)">Chișinău sediul Central (Botanica)</SelectItem>
              <SelectItem value="Chișinău sediul Buiucani">Chișinău sediul Buiucani</SelectItem>
              <SelectItem value="Chișinău sediul Ciocana">Chișinău sediul Ciocana</SelectItem>
              <SelectItem value="Chișinău sediul Centru">Chișinău sediul Centru</SelectItem>
              <SelectItem value="Chișinău sediul Râșcani">Chișinău sediul Râșcani</SelectItem>
              <SelectItem value="Criuleni sediul Central">Criuleni sediul Central</SelectItem>
              <SelectItem value="Criuleni sediul Dubăsari">Criuleni sediul Dubăsari</SelectItem>
              <SelectItem value="Hâncești sediul Central">Hâncești sediul Central</SelectItem>
              <SelectItem value="Hâncești sediul Ialoveni">Hâncești sediul Ialoveni</SelectItem>
              <SelectItem value="Hâncești sediul Leova">Hâncești sediul Leova</SelectItem>
              <SelectItem value="Orhei sediul Central">Orhei sediul Central</SelectItem>
              <SelectItem value="Orhei sediul Telenești">Orhei sediul Telenești</SelectItem>
              <SelectItem value="Orhei sediul Rezina">Orhei sediul Rezina</SelectItem>
              <SelectItem value="Strășeni sediul Central">Strășeni sediul Central</SelectItem>
              <SelectItem value="Strășeni sediul Călărași">Strășeni sediul Călărași</SelectItem>
              <SelectItem value="Căușeni sediul Central">Căușeni sediul Central</SelectItem>
              <SelectItem value="Căușeni sediul Ștefan Vodă">Căușeni sediul Ștefan Vodă</SelectItem>
              <SelectItem value="Căușeni sediul Bender (Varnița)">Căușeni sediul Bender (Varnița)</SelectItem>
              <SelectItem value="Căușeni sediul Anenii Noi">Căușeni sediul Anenii Noi</SelectItem>
              <SelectItem value="Ungheni">Ungheni</SelectItem>
              <SelectItem value="Bălți sediul Central">Bălți sediul Central</SelectItem>
              <SelectItem value="Bălți sediul Fălești">Bălți sediul Fălești</SelectItem>
              <SelectItem value="Bălți sediul Sângerei">Bălți sediul Sângerei</SelectItem>
              <SelectItem value="Bălți sediul Glodeni">Bălți sediul Glodeni</SelectItem>
              <SelectItem value="Drochia sediul Central">Drochia sediul Central</SelectItem>
              <SelectItem value="Drochia sediul Râșcani">Drochia sediul Râșcani</SelectItem>
              <SelectItem value="Drochia sediul Dondușeni">Drochia sediul Dondușeni</SelectItem>
              <SelectItem value="Edineț sediul Central">Edineț sediul Central</SelectItem>
              <SelectItem value="Edineț sediul Briceni">Edineț sediul Briceni</SelectItem>
              <SelectItem value="Edineț sediul Ocnița">Edineț sediul Ocnița</SelectItem>
              <SelectItem value="Soroca sediul Central">Soroca sediul Central</SelectItem>
              <SelectItem value="Cahul sediul Central">Cahul sediul Central</SelectItem>
              <SelectItem value="Cahul sediul Taraclia">Cahul sediul Taraclia</SelectItem>
              <SelectItem value="Cahul sediul Cantemir">Cahul sediul Cantemir</SelectItem>
              <SelectItem value="Cahul sediul Vulcănești">Cahul sediul Vulcănești</SelectItem>
              <SelectItem value="Comrat sediul Central">Comrat sediul Central</SelectItem>
              <SelectItem value="Comrat sediul Ceadâr-Lunga">Comrat sediul Ceadâr-Lunga</SelectItem>
              <SelectItem value="Cimișlia">Cimișlia</SelectItem>
              <SelectItem value="Curtea de Apel Centru">Curtea de Apel Centru</SelectItem>
              <SelectItem value="Curtea de Apel Nord">Curtea de Apel Nord</SelectItem>
              <SelectItem value="Curtea de Apel Sud sediul central Cahul">Curtea de Apel Sud sediul central Cahul</SelectItem>
              <SelectItem value="Curtea de Apel Sud sediul secundar Comrat">Curtea de Apel Sud sediul secundar Comrat</SelectItem>
              <SelectItem value="Curtea Supremă de Justiție">Curtea Supremă de Justiție</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tip hotarire</Label>
            <Select value={tipHotarire} onValueChange={setTipHotarire}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteaza tipul..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Fara tip --</SelectItem>
                <SelectItem value="Sentință">Sentință</SelectItem>
                <SelectItem value="Încheiere">Încheiere</SelectItem>
                <SelectItem value="Decizie">Decizie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataHotarire">Data hotaririi</Label>
            <Input
              id="dataHotarire"
              type="date"
              value={dataHotarire}
              onChange={(e) => setDataHotarire(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Destinatari {selectedDestinatari.length > 0 && `(${selectedDestinatari.length} selectati)`}</Label>
          {loadingUsers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-md max-h-[200px] overflow-y-auto">
              {users.map(user => (
                <div
                  key={user.id}
                  onClick={() => toggleDestinatar(user.id)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-b-0',
                    selectedDestinatari.includes(user.id) && 'bg-blue-50'
                  )}
                >
                  <div className={cn(
                    'h-5 w-5 rounded border flex items-center justify-center',
                    selectedDestinatari.includes(user.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  )}>
                    {selectedDestinatari.includes(user.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm">{user.full_name}</span>
                  <span className="text-xs text-muted-foreground">@{user.username}</span>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nu s-au gasit utilizatori
                </p>
              )}
            </div>
          )}
        </div>

        {/* Multi-person select */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Persoane legate
            {selectedPersons.length > 1 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {selectedPersons.length} persoane = {selectedPersons.length} sarcini separate
              </span>
            )}
          </Label>

          {/* Selected persons chips */}
          {selectedPersons.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedPersons.map(person => (
                <div
                  key={person.id}
                  className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-sm"
                >
                  <span>{person.last_name} {person.first_name}</span>
                  <button
                    onClick={() => removePerson(person.id)}
                    className="ml-1 text-blue-500 hover:text-blue-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Person search input */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                onFocus={() => personResults.length > 0 && setShowPersonDropdown(true)}
                onBlur={() => setTimeout(() => setShowPersonDropdown(false), 200)}
                placeholder="Cauta persoana dupa nume..."
                className="pl-9"
              />
              {searchingPersons && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search results dropdown */}
            {showPersonDropdown && personResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                {personResults.map(person => (
                  <div
                    key={person.id}
                    onMouseDown={(e) => { e.preventDefault(); addPerson(person) }}
                    className="px-3 py-2 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 text-sm"
                  >
                    <span className="font-medium">{person.last_name} {person.first_name}</span>
                    {person.cnp && (
                      <span className="text-xs text-muted-foreground ml-2">CNP: {person.cnp}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showPersonDropdown && personSearch.length >= 2 && personResults.length === 0 && !searchingPersons && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
                <p className="px-3 py-2 text-sm text-muted-foreground text-center">
                  Nu s-au gasit persoane
                </p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Selecteaza mai multe persoane pentru a crea cate o sarcina separata per persoana.
          </p>
        </div>

        <Separator />

        {/* Save as template */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="save-sablon"
              checked={saveAsSablon}
              onCheckedChange={(checked) => setSaveAsSablon(!!checked)}
            />
            <Label htmlFor="save-sablon" className="cursor-pointer text-sm">
              Salveaza ca sablon pentru utilizare ulterioara
            </Label>
          </div>
          {saveAsSablon && (
            <Input
              value={numeSablon}
              onChange={(e) => setNumeSablon(e.target.value)}
              placeholder="Numele sablonului (ex: Verificare dosar Art.91)"
            />
          )}
        </div>
      </div>
    </div>
  )
}
