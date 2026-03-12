'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate, getFiscalYear, getFiscalYearLabel } from '@/lib/utils'
import type { NtlRate } from '@/types/app.types'

interface RateWithSetter extends NtlRate {
  setter?: { full_name: string }
}

export default function NtlRatePage() {
  const [rates, setRates] = useState<RateWithSetter[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [rateInput, setRateInput] = useState('')
  const currentFY = getFiscalYear()

  const fetchRates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ntl-rate')
      if (!res.ok) throw new Error('Failed to load rates')
      const data: RateWithSetter[] = await res.json()
      setRates(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  const currentRate = rates.find((r) => r.fiscal_year === String(currentFY))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const parsed = parseFloat(rateInput)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid dollar amount greater than $0.00')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/ntl-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: parsed, fiscal_year: String(currentFY) }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to save rate')
      }
      setSuccessMsg(`Rate set to ${formatCurrency(parsed)} for ${getFiscalYearLabel(currentFY)}`)
      setRateInput('')
      await fetchRates()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">NTL Rate</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the non-traditional learning hourly pay rate per fiscal year.
        </p>
      </div>

      {/* Current Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Rate</CardTitle>
          <CardDescription>{getFiscalYearLabel(currentFY)}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner size="md" />
          ) : currentRate ? (
            <div className="flex items-center gap-4">
              <span className="text-4xl font-bold text-green-700">
                {formatCurrency(currentRate.rate)}
              </span>
              <span className="text-sm text-muted-foreground">/ hour</span>
              <Badge variant="success">Active</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No rate set for {getFiscalYearLabel(currentFY)} yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Set New Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Set New Rate</CardTitle>
          <CardDescription>
            Setting a new rate for {getFiscalYearLabel(currentFY)} will replace the existing one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="rate-input">Hourly Rate (USD)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                  </span>
                  <Input
                    id="rate-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <Label>Fiscal Year</Label>
                <p className="mt-1 h-10 flex items-center text-sm font-medium text-gray-700 px-3 border rounded-md bg-muted/50">
                  {getFiscalYearLabel(currentFY)}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {successMsg && (
              <p className="text-sm text-green-600">{successMsg}</p>
            )}

            <Button type="submit" disabled={submitting || !rateInput}>
              {submitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save Rate'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rate History</CardTitle>
          <CardDescription>All NTL rates across fiscal years.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner size="md" />
          ) : rates.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No rates recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fiscal Year</TableHead>
                  <TableHead>Rate / Hour</TableHead>
                  <TableHead>Set By</TableHead>
                  <TableHead>Set At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {getFiscalYearLabel(parseInt(r.fiscal_year, 10))}
                    </TableCell>
                    <TableCell>{formatCurrency(r.rate)}</TableCell>
                    <TableCell>{r.setter?.full_name ?? r.set_by}</TableCell>
                    <TableCell>{formatDate(r.set_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
