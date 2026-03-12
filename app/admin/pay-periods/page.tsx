'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, getFiscalYearLabel } from '@/lib/utils'
import type { PayPeriod } from '@/types/app.types'
import { UploadCloud, CheckCircle, AlertCircle, X } from 'lucide-react'

interface PayPeriodWithCount extends PayPeriod {
  program_pay_periods: { count: number }[]
}

interface CsvRow {
  label: string
  start_date: string
  end_date: string
}

interface UploadResult {
  inserted: number
  skipped: { row: CsvRow; reason: string }[]
}

function parseCsvRows(text: string): CsvRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const labelIdx = headers.indexOf('label')
  const startIdx = headers.indexOf('start_date')
  const endIdx = headers.indexOf('end_date')

  if (labelIdx === -1 || startIdx === -1 || endIdx === -1) {
    throw new Error('CSV must have columns: label, start_date, end_date')
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    return {
      label: cols[labelIdx] ?? '',
      start_date: cols[startIdx] ?? '',
      end_date: cols[endIdx] ?? '',
    }
  }).filter((row) => row.label || row.start_date || row.end_date)
}

export default function PayPeriodsPage() {
  const [periods, setPeriods] = useState<PayPeriodWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // CSV upload state
  const [isDragging, setIsDragging] = useState(false)
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchPeriods = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/pay-periods/upload')
      if (!res.ok) throw new Error('Failed to load pay periods')
      const data: PayPeriodWithCount[] = await res.json()
      setPeriods(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPeriods()
  }, [fetchPeriods])

  // Group periods by fiscal year
  const grouped = periods.reduce<Record<string, PayPeriodWithCount[]>>((acc, p) => {
    const fy = p.fiscal_year
    if (!acc[fy]) acc[fy] = []
    acc[fy].push(p)
    return acc
  }, {})
  const sortedFYs = Object.keys(grouped).sort((a, b) => Number(b) - Number(a))

  function handleFileSelect(file: File) {
    setParseError(null)
    setPreviewRows([])
    setUploadResult(null)

    if (!file.name.endsWith('.csv')) {
      setParseError('Please select a .csv file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const rows = parseCsvRows(text)
        if (rows.length === 0) {
          setParseError('No valid rows found in the CSV file')
          return
        }
        setPreviewRows(rows)
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse CSV')
      }
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  async function handleConfirmUpload() {
    setUploading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/pay-periods/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: previewRows }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Upload failed')
      }
      const result: UploadResult = await res.json()
      setUploadResult(result)
      setPreviewRows([])
      await fetchPeriods()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleClearPreview() {
    setPreviewRows([])
    setParseError(null)
    setUploadResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pay Periods</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload pay period schedules via CSV and manage existing periods.
        </p>
      </div>

      {/* CSV Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Pay Periods</CardTitle>
          <CardDescription>
            Upload a CSV with columns: <code className="font-mono text-xs bg-muted px-1 rounded">label</code>,{' '}
            <code className="font-mono text-xs bg-muted px-1 rounded">start_date</code>,{' '}
            <code className="font-mono text-xs bg-muted px-1 rounded">end_date</code> (YYYY-MM-DD format).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            }`}
          >
            <UploadCloud className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-gray-700">
              Drag &amp; drop a CSV file here, or{' '}
              <span className="text-blue-600 underline">click to browse</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supported format: .csv
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          {parseError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {/* Preview table */}
          {previewRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  Preview: {previewRows.length} row{previewRows.length !== 1 ? 's' : ''} ready to import
                </p>
                <Button variant="ghost" size="sm" onClick={handleClearPreview}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
              <div className="overflow-auto rounded-md border max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>{row.label}</TableCell>
                        <TableCell>{row.start_date}</TableCell>
                        <TableCell>{row.end_date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={handleConfirmUpload} disabled={uploading}>
                {uploading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Importing...
                  </>
                ) : (
                  `Confirm Import (${previewRows.length} rows)`
                )}
              </Button>
            </div>
          )}

          {/* Upload result */}
          {uploadResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                Successfully imported {uploadResult.inserted} pay period{uploadResult.inserted !== 1 ? 's' : ''}.
              </div>
              {uploadResult.skipped.length > 0 && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
                  <p className="font-medium mb-1">
                    {uploadResult.skipped.length} row{uploadResult.skipped.length !== 1 ? 's' : ''} skipped:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {uploadResult.skipped.map((s, i) => (
                      <li key={i}>
                        <span className="font-mono">{s.row.label}</span>: {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Existing Pay Periods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Pay Periods</CardTitle>
          <CardDescription>Grouped by fiscal year.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner size="md" />
          ) : periods.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No pay periods uploaded yet.
            </p>
          ) : (
            <div className="space-y-6">
              {sortedFYs.map((fy) => (
                <div key={fy}>
                  <h4 className="mb-2 text-sm font-semibold text-gray-700">
                    {getFiscalYearLabel(parseInt(fy, 10))}
                    <Badge variant="outline" className="ml-2">
                      {grouped[fy].length} periods
                    </Badge>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Fiscal Year</TableHead>
                        <TableHead className="text-right">Programs Assigned</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grouped[fy].map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.label}</TableCell>
                          <TableCell>{formatDate(p.start_date)}</TableCell>
                          <TableCell>{formatDate(p.end_date)}</TableCell>
                          <TableCell>{getFiscalYearLabel(parseInt(p.fiscal_year, 10))}</TableCell>
                          <TableCell className="text-right">
                            {p.program_pay_periods?.[0]?.count ?? 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
