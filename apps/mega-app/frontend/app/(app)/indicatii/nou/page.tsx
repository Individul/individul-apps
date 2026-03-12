'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { TaskUser, indicatiiApi, tasksApi } from '@/lib/api'
import { useUserRole } from '@/lib/use-user-role'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Loader2,
  Save,
  Check,
} from 'lucide-react'

export default function IndicatieNouaPage() {
  const router = useRouter()
  const { isViewer } = useUserRole()
  const [users, setUsers] = useState<TaskUser[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)

  // Form state
  const [titlu, setTitlu] = useState('')
  const [descriere, setDescriere] = useState('')
  const [prioritate, setPrioritate] = useState<string>('NORMAL')
  const [termenLimita, setTermenLimita] = useState('')
  const [selectedDestinatari, setSelectedDestinatari] = useState<number[]>([])
  const [persoanaLegata, setPersoanaLegata] = useState('')

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
  }, [isViewer, router])

  function toggleDestinatar(userId: number) {
    setSelectedDestinatari(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  async function handleSave() {
    if (!titlu.trim()) return
    if (selectedDestinatari.length === 0) return
    setSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) return
      await indicatiiApi.create(token, {
        titlu: titlu.trim(),
        descriere: descriere.trim(),
        prioritate,
        termen_limita: termenLimita || null,
        destinatari_ids: selectedDestinatari,
        persoana_legata_name: persoanaLegata.trim() || null,
      })
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
          <h1 className="font-semibold">Indicatie noua</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/indicatii">
            <Button variant="outline">Anuleaza</Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={saving || !titlu.trim() || selectedDestinatari.length === 0}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salveaza
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="titlu">Titlu *</Label>
          <Input
            id="titlu"
            value={titlu}
            onChange={(e) => setTitlu(e.target.value)}
            placeholder="Titlul indicatiei"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descriere">Descriere</Label>
          <Textarea
            id="descriere"
            value={descriere}
            onChange={(e) => setDescriere(e.target.value)}
            placeholder="Descrierea indicatiei"
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
          <Label>Destinatari * {selectedDestinatari.length > 0 && `(${selectedDestinatari.length} selectati)`}</Label>
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

        <div className="space-y-2">
          <Label htmlFor="persoana">Persoana legata (optional)</Label>
          <Input
            id="persoana"
            value={persoanaLegata}
            onChange={(e) => setPersoanaLegata(e.target.value)}
            placeholder="Numele persoanei legate"
          />
        </div>
      </div>
    </div>
  )
}
