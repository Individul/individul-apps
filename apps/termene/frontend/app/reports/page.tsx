'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Separator } from '@/components/ui/separator'
import { personsApi } from '@/lib/api'

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [status, setStatus] = useState<string>('')
  const [fractionType, setFractionType] = useState<string>('')

  const handleExportXlsx = () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const params = new URLSearchParams()
    if (startDate) {
      params.set('admission_date__gte', startDate.toISOString().split('T')[0])
    }
    if (endDate) {
      params.set('admission_date__lte', endDate.toISOString().split('T')[0])
    }

    const url = personsApi.exportXlsx(token, params)
    window.open(`${url}&token=${token}`, '_blank')
    toast.success('Exportul XLSX a început')
  }

  const handleExportPdf = () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const params = new URLSearchParams()
    if (startDate) {
      params.set('admission_date__gte', startDate.toISOString().split('T')[0])
    }
    if (endDate) {
      params.set('admission_date__lte', endDate.toISOString().split('T')[0])
    }

    const url = personsApi.exportPdf(token, params)
    window.open(`${url}&token=${token}`, '_blank')
    toast.success('Exportul PDF a început')
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">Rapoarte</h1>
          <p className="text-muted-foreground">Generare și export rapoarte</p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtre</CardTitle>
            <CardDescription>Selectează criteriile pentru raport</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Data internării - de la</Label>
                <DatePicker
                  date={startDate}
                  onSelect={setStartDate}
                  placeholder="Selectează data de început"
                />
              </div>
              <div className="space-y-2">
                <Label>Data internării - până la</Label>
                <DatePicker
                  date={endDate}
                  onSelect={setEndDate}
                  placeholder="Selectează data de sfârșit"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status sentință</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate</SelectItem>
                    <SelectItem value="active">Activă</SelectItem>
                    <SelectItem value="suspended">Suspendată</SelectItem>
                    <SelectItem value="completed">Finalizată</SelectItem>
                    <SelectItem value="conditionally_released">Liberare condiționată</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tip fracție</Label>
                <Select value={fractionType} onValueChange={setFractionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate</SelectItem>
                    <SelectItem value="1/3">1/3</SelectItem>
                    <SelectItem value="1/2">1/2</SelectItem>
                    <SelectItem value="2/3">2/3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>Descarcă raportul în formatul dorit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button onClick={handleExportXlsx} className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Export XLSX
              </Button>
              <Button variant="outline" onClick={handleExportPdf} className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Types */}
        <Card>
          <CardHeader>
            <CardTitle>Tipuri de Rapoarte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border">
                <h4 className="font-medium">Lista Persoanelor Condamnate</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Conține toate persoanele înregistrate cu date personale și numărul de sentințe active.
                </p>
              </div>
              <Separator />
              <div className="p-4 rounded-lg border">
                <h4 className="font-medium">Termene Apropiate</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Lista fracțiilor cu termene în următoarele 30 de zile, ordonate după dată.
                </p>
              </div>
              <Separator />
              <div className="p-4 rounded-lg border">
                <h4 className="font-medium">Termene Depășite</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Lista fracțiilor cu termene depășite care necesită atenție imediată.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
