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
import { ChevronLeft, FileDown, CalendarDays } from 'lucide-react'

interface PayPeriod {
  id: string
  label: string
  start_date: string
  end_date: string
  fiscal_year: string
}

interface Preview {
  total_timecards: number
  total_programs: number
}

export default function ReportByPayPeriodPage() {
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([])
  const [loadingPPs, setLoadingPPs] = useState(true)
  const [selectedPP, setSelectedPP] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load pay periods
  useEffect(() => {
    async function load() {
      setLoadingPPs(true)
      try {
        const res = await fetch('/api/admin/pay-periods')
        if (!res.ok) throw new Error('Failed to load pay periods')
        const data: PayPeriod[] = await res.json()
        setPayPeriods(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load pay periods')
      } finally {
        setLoadingPPs(false)
      }
    }
    load()
  }, [])

  // Load preview when pay period changes
  const loadPreview = useCallback(async (ppId: string) => {
    if (!ppId) { setPreview(null); return }
    setLoadingPreview(true)
    setPreview(null)
    setError(null)
    try {
      const res = await fetch(`/api/admin/reports/pay-period?pay_period_id=${ppId}`)
      if (!res.ok) throw new Error('Failed to load preview')
      const data: Preview = await res.json()
      setPreview(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load preview')
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  function handleSelectPP(value: string) {
    setSelectedPP(value)
    loadPreview(value)
  }

  async function handleGeneratePDF() {
    if (!selectedPP) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/reports/pay-period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pay_period_id: selectedPP }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const pp = payPeriods.find((p) => p.id === selectedPP)
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        `NPS_Timecards_${(pp?.label ?? '').replace(/\s+/g, '_')}_AllPrograms.pdf`
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
          <CalendarDays className="h-5 w-5 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Report by Pay Period</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a consolidated PDF of all signed timecards for a pay period.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Pay Period</CardTitle>
          <CardDescription>
            Choose a pay period to generate the report for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPPs ? (
            <Spinner size="sm" />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pp-select">Pay Period</Label>
              <Select value={selectedPP} onValueChange={handleSelectPP}>
                <SelectTrigger id="pp-select" className="w-full">
                  <SelectValue placeholder="Select a pay period..." />
                </SelectTrigger>
                <SelectContent>
                  {payPeriods.map((pp) => (
                    <SelectItem key={pp.id} value={pp.id}>
                      {pp.label}{' '}
                      <span className="text-muted-foreground text-xs ml-1">
                        ({pp.start_date} – {pp.end_date})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview */}
          {selectedPP && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-sm font-semibold mb-2">Report Preview</p>
              {loadingPreview ? (
                <Spinner size="sm" />
              ) : preview ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {preview.total_timecards}
                    </p>
                    <p className="text-xs text-muted-foreground">Signed Timecards</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {preview.total_programs}
                    </p>
                    <p className="text-xs text-muted-foreground">Programs</p>
                  </div>
                  {selectedPPData && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">
                        <strong>Pay Period:</strong> {selectedPPData.label} &bull;{' '}
                        {selectedPPData.start_date} – {selectedPPData.end_date} &bull; FY{' '}
                        {selectedPPData.fiscal_year}
                      </p>
                    </div>
                  )}
                  {preview.total_timecards === 0 && (
                    <p className="col-span-2 text-sm text-amber-600">
                      No signed timecards found for this pay period. The PDF will be empty.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate button */}
      {selectedPP && !loadingPreview && (
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
