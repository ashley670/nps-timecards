'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, FileDown, Briefcase } from 'lucide-react'

interface Program {
  id: string
  name: string
  account_number: string
  is_active: boolean
}

interface PayPeriod {
  id: string
  label: string
  start_date: string
  end_date: string
  fiscal_year: string
}

interface Preview {
  total_timecards: number
}

export default function ReportByProgramPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [selectedProgram, setSelectedProgram] = useState('')
  const [selectedPP, setSelectedPP] = useState('all')

  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load programs and pay periods
  useEffect(() => {
    async function load() {
      setLoadingData(true)
      try {
        const [progRes, ppRes] = await Promise.all([
          fetch('/api/admin/programs'),
          fetch('/api/admin/pay-periods'),
        ])
        if (!progRes.ok) throw new Error('Failed to load programs')
        if (!ppRes.ok) throw new Error('Failed to load pay periods')
        const [progData, ppData] = await Promise.all([progRes.json(), ppRes.json()])
        setPrograms(progData)
        setPayPeriods(ppData)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [])

  // Load preview
  const loadPreview = useCallback(async (programId: string, ppId: string) => {
    if (!programId) { setPreview(null); return }
    setLoadingPreview(true)
    setPreview(null)
    setError(null)
    try {
      const params = new URLSearchParams({ program_id: programId })
      if (ppId && ppId !== 'all') params.set('pay_period_id', ppId)
      const res = await fetch(`/api/admin/reports/program?${params}`)
      if (!res.ok) throw new Error('Failed to load preview')
      const data: Preview = await res.json()
      setPreview(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load preview')
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  function handleSelectProgram(value: string) {
    setSelectedProgram(value)
    loadPreview(value, selectedPP)
  }

  function handleSelectPP(value: string) {
    setSelectedPP(value)
    if (selectedProgram) loadPreview(selectedProgram, value)
  }

  async function handleGeneratePDF() {
    if (!selectedProgram) return
    setGenerating(true)
    setError(null)
    try {
      const body: Record<string, string> = { program_id: selectedProgram }
      if (selectedPP) body.pay_period_id = selectedPP
      const res = await fetch('/api/admin/reports/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const prog = programs.find((p) => p.id === selectedProgram)
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        `NPS_Timecards_${(prog?.name ?? '').replace(/\s+/g, '_')}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setGenerating(false)
    }
  }

  const selectedProgData = programs.find((p) => p.id === selectedProgram)
  const selectedPPData = payPeriods.find((p) => p.id === selectedPP)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link href="/admin/reports">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Reports
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-900">Report by Program</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a PDF of signed timecards for a specific program.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>
            Select a program and optionally filter by pay period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingData ? (
            <Spinner size="sm" />
          ) : (
            <>
              <div className="space-y-2">
                <Label>Program *</Label>
                <Select value={selectedProgram} onValueChange={handleSelectProgram}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a program..." />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {!p.is_active && (
                          <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pay Period</Label>
                <Select value={selectedPP} onValueChange={handleSelectPP}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Pay Periods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pay Periods</SelectItem>
                    {payPeriods.map((pp) => (
                      <SelectItem key={pp.id} value={pp.id}>
                        {pp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Preview */}
          {selectedProgram && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-sm font-semibold mb-2">Report Preview</p>
              {loadingPreview ? (
                <Spinner size="sm" />
              ) : preview ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-2xl font-bold text-purple-600">
                      {preview.total_timecards}
                    </p>
                    <p className="text-xs text-muted-foreground">Signed Timecards</p>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      <strong>Program:</strong> {selectedProgData?.name}
                    </p>
                    <p>
                      <strong>Pay Period:</strong>{' '}
                      {selectedPP === 'all'
                        ? 'All Pay Periods'
                        : selectedPPData?.label ?? selectedPP}
                    </p>
                  </div>
                  {preview.total_timecards === 0 && (
                    <p className="text-sm text-amber-600 mt-2">
                      No signed timecards found for these filters.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProgram && !loadingPreview && (
        <div className="flex items-center gap-4">
          <Button
            size="lg"
            onClick={handleGeneratePDF}
            disabled={generating}
            className="gap-2"
          >
            {generating ? (
              <>
                <Spinner size="sm" />
                Generating your PDF, please wait...
              </>
            ) : (
              <>
                <FileDown className="h-5 w-5" />
                Generate PDF
              </>
            )}
          </Button>
          {generating && (
            <p className="text-sm text-muted-foreground animate-pulse">
              Building the report, this may take a moment...
            </p>
          )}
        </div>
      )}
    </div>
  )
}
