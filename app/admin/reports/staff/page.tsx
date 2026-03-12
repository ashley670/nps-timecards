'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, FileDown, User, Search, X } from 'lucide-react'

interface StaffUser {
  id: string
  full_name: string
  email: string
  role: string
}

interface Program {
  id: string
  name: string
}

interface PayPeriod {
  id: string
  label: string
  start_date: string
  end_date: string
}

interface Preview {
  total_timecards: number
}

export default function ReportByStaffPage() {
  // Staff search
  const [staffSearch, setStaffSearch] = useState('')
  const [staffResults, setStaffResults] = useState<StaffUser[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Filters
  const [programs, setPrograms] = useState<Program[]>([])
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([])
  const [loadingFilters, setLoadingFilters] = useState(true)
  const [selectedProgram, setSelectedProgram] = useState('all')
  const [selectedPP, setSelectedPP] = useState('all')

  // Preview & generation
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load filter data
  useEffect(() => {
    async function load() {
      setLoadingFilters(true)
      try {
        const [progRes, ppRes] = await Promise.all([
          fetch('/api/admin/programs'),
          fetch('/api/admin/pay-periods'),
        ])
        const [progData, ppData] = await Promise.all([progRes.json(), ppRes.json()])
        setPrograms(progData)
        setPayPeriods(ppData)
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingFilters(false)
      }
    }
    load()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Staff typeahead search
  function handleStaffSearchChange(value: string) {
    setStaffSearch(value)
    setSelectedStaff(null)
    setPreview(null)

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)

    if (!value.trim()) {
      setStaffResults([])
      setShowDropdown(false)
      return
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(
          `/api/admin/users?role=staff&search=${encodeURIComponent(value.trim())}`
        )
        if (!res.ok) return
        const data: StaffUser[] = await res.json()
        setStaffResults(data)
        setShowDropdown(true)
      } catch (e) {
        console.error(e)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  function selectStaff(staff: StaffUser) {
    setSelectedStaff(staff)
    setStaffSearch(staff.full_name)
    setShowDropdown(false)
    loadPreview(staff.id, selectedProgram, selectedPP)
  }

  function clearStaff() {
    setSelectedStaff(null)
    setStaffSearch('')
    setStaffResults([])
    setPreview(null)
  }

  // Load preview
  const loadPreview = useCallback(async (staffId: string, progId: string, ppId: string) => {
    if (!staffId) { setPreview(null); return }
    setLoadingPreview(true)
    setPreview(null)
    setError(null)
    try {
      const params = new URLSearchParams({ staff_id: staffId })
      if (progId && progId !== 'all') params.set('program_id', progId)
      if (ppId && ppId !== 'all') params.set('pay_period_id', ppId)
      const res = await fetch(`/api/admin/reports/staff?${params}`)
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
    if (selectedStaff) loadPreview(selectedStaff.id, value, selectedPP)
  }

  function handleSelectPP(value: string) {
    setSelectedPP(value)
    if (selectedStaff) loadPreview(selectedStaff.id, selectedProgram, value)
  }

  async function handleGeneratePDF() {
    if (!selectedStaff) return
    setGenerating(true)
    setError(null)
    try {
      const body: Record<string, string> = { staff_id: selectedStaff.id }
      if (selectedProgram && selectedProgram !== 'all') body.program_id = selectedProgram
      if (selectedPP && selectedPP !== 'all') body.pay_period_id = selectedPP

      const res = await fetch('/api/admin/reports/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        `NPS_Timecards_${selectedStaff.full_name.replace(/\s+/g, '_')}.pdf`
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
          <User className="h-5 w-5 text-emerald-600" />
          <h2 className="text-2xl font-bold text-gray-900">Report by Staff Member</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a PDF of signed timecards for a specific staff member.
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
          <CardDescription>Search for a staff member and apply optional filters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Staff typeahead */}
          <div className="space-y-2">
            <Label>Staff Member *</Label>
            <div className="relative" ref={searchContainerRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-9 pr-9"
                  value={staffSearch}
                  onChange={(e) => handleStaffSearchChange(e.target.value)}
                  onFocus={() => {
                    if (staffResults.length > 0) setShowDropdown(true)
                  }}
                />
                {(staffSearch || selectedStaff) && (
                  <button
                    type="button"
                    onClick={clearStaff}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Spinner size="sm" />
                    </div>
                  ) : staffResults.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground italic">
                      No staff members found.
                    </p>
                  ) : (
                    staffResults.map((staff) => (
                      <button
                        key={staff.id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        onClick={() => selectStaff(staff)}
                      >
                        <p className="text-sm font-medium">{staff.full_name}</p>
                        <p className="text-xs text-muted-foreground">{staff.email}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedStaff && (
              <p className="text-xs text-emerald-600 font-medium">
                Selected: {selectedStaff.full_name} ({selectedStaff.email})
              </p>
            )}
          </div>

          {/* Program filter */}
          <div className="space-y-2">
            <Label>Program (optional)</Label>
            {loadingFilters ? (
              <Spinner size="sm" />
            ) : (
              <Select value={selectedProgram} onValueChange={handleSelectProgram}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Pay period filter */}
          <div className="space-y-2">
            <Label>Pay Period (optional)</Label>
            {loadingFilters ? (
              <Spinner size="sm" />
            ) : (
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
            )}
          </div>

          {/* Preview */}
          {selectedStaff && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-sm font-semibold mb-2">Report Preview</p>
              {loadingPreview ? (
                <Spinner size="sm" />
              ) : preview ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">
                      {preview.total_timecards}
                    </p>
                    <p className="text-xs text-muted-foreground">Signed Timecards</p>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      <strong>Staff:</strong> {selectedStaff.full_name}
                    </p>
                    <p>
                      <strong>Program:</strong>{' '}
                      {selectedProgram === 'all'
                        ? 'All Programs'
                        : selectedProgData?.name ?? selectedProgram}
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

      {selectedStaff && !loadingPreview && (
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
