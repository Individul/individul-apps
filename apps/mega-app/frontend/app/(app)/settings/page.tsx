'use client'

import { useEffect, useState } from 'react'
import { Settings, Mail, Send, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { monitorEmailApi } from '@/lib/api'

interface EmailSettings {
  enabled: boolean
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  use_tls: boolean
  email_from: string
  email_to: string
  last_sent: string | null
  last_error: string | null
}

const DEFAULT_SETTINGS: EmailSettings = {
  enabled: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_password: '',
  use_tls: true,
  email_from: '',
  email_to: '',
  last_sent: null,
  last_error: null,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sendingDigest, setSendingDigest] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    monitorEmailApi
      .getSettings(token)
      .then((data) => {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          smtp_password: '', // never show password
        })
      })
      .catch(() => {
        toast.error('Nu s-au putut incarca setarile')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setSaving(true)
    try {
      const payload: Record<string, any> = { ...settings }
      // Don't send empty password (keep existing on server)
      if (!payload.smtp_password) {
        delete payload.smtp_password
      }
      // Remove status fields
      delete payload.last_sent
      delete payload.last_error

      await monitorEmailApi.saveSettings(token, payload)
      toast.success('Setarile au fost salvate')
    } catch (err: any) {
      toast.error(err?.message || 'Eroare la salvarea setarilor')
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setTesting(true)
    try {
      await monitorEmailApi.testEmail(token)
      toast.success('Email de test trimis cu succes')
    } catch (err: any) {
      toast.error(err?.message || 'Eroare la trimiterea emailului de test')
    } finally {
      setTesting(false)
    }
  }

  const handleSendNow = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setSendingDigest(true)
    try {
      await monitorEmailApi.sendNow(token)
      toast.success('Digest trimis cu succes')
    } catch (err: any) {
      toast.error(err?.message || 'Eroare la trimiterea digestului')
    } finally {
      setSendingDigest(false)
    }
  }

  const updateField = <K extends keyof EmailSettings>(
    field: K,
    value: EmailSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Setari</h1>
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center text-sm text-slate-500">
              Se incarca setarile...
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Setari</h1>

      {/* Email Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configurare Notificari Email
          </CardTitle>
          <CardDescription>
            Configureaza serverul SMTP pentru trimiterea notificarilor prin email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                updateField('enabled', checked === true)
              }
            />
            <Label htmlFor="enabled" className="text-sm font-medium cursor-pointer">
              Notificari email active
            </Label>
          </div>

          <Separator />

          {/* SMTP Settings */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Server SMTP
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input
                  id="smtp_host"
                  type="text"
                  value={settings.smtp_host}
                  onChange={(e) => updateField('smtp_host', e.target.value)}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  value={settings.smtp_port}
                  onChange={(e) =>
                    updateField('smtp_port', parseInt(e.target.value, 10) || 0)
                  }
                  placeholder="587"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_user">SMTP User</Label>
                <Input
                  id="smtp_user"
                  type="text"
                  value={settings.smtp_user}
                  onChange={(e) => updateField('smtp_user', e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_password">SMTP Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  value={settings.smtp_password}
                  onChange={(e) => updateField('smtp_password', e.target.value)}
                  placeholder="Lasa gol pentru a pastra parola curenta"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Checkbox
                id="use_tls"
                checked={settings.use_tls}
                onCheckedChange={(checked) =>
                  updateField('use_tls', checked === true)
                }
              />
              <Label htmlFor="use_tls" className="text-sm cursor-pointer">
                Foloseste TLS
              </Label>
            </div>
          </div>

          <Separator />

          {/* Email addresses */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Adrese Email
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email_from">Email From</Label>
                <Input
                  id="email_from"
                  type="text"
                  value={settings.email_from}
                  onChange={(e) => updateField('email_from', e.target.value)}
                  placeholder="noreply@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_to">Email To</Label>
                <Input
                  id="email_to"
                  type="text"
                  value={settings.email_to}
                  onChange={(e) => updateField('email_to', e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  Se salveaza...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Salveaza
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleTestEmail}
              disabled={testing}
            >
              {testing ? (
                <>
                  <span className="mr-2 h-4 w-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin inline-block" />
                  Se trimite...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Trimite email de test
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleSendNow}
              disabled={sendingDigest}
            >
              {sendingDigest ? (
                <>
                  <span className="mr-2 h-4 w-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin inline-block" />
                  Se trimite...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Trimite digest acum
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Card */}
      {(settings.last_sent || settings.last_error) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings.last_sent && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-slate-500">Ultima trimitere:</span>
                <span className="font-medium text-slate-700">
                  {new Date(settings.last_sent).toLocaleString('ro-RO')}
                </span>
              </div>
            )}
            {settings.last_error && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <span className="text-slate-500">Ultima eroare:</span>
                <span className="font-medium text-red-600">
                  {settings.last_error}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
