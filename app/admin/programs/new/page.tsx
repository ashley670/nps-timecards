'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, Upload, CheckCircle2, ChevronRight } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffRow {
  id: string // local key
  full_name: string
  email: string
  school: string
}

interface SigneeUser {
  id: string
  full_name: string
  email: string
}

interface SigneeAssignment {
  signee_id: string
  staff_id?: string | null // null = covers all staff
}

interface PayPeriod {
  id: string
  label: string
  start_date: string
  end_date: string
  fiscal_year: string
}

interface SelectedPayPeriod {
  pay_period_id: string
  submit_deadline: string
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = ['Program Info', 'Add Staff', 'Assign Signees', 'Assign Pay Periods']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, idx) => {
        const stepNum = idx + 1
        const isActive = stepNum === current
        const isDone = stepNum < current
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors ${
                isDone
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-gray-300 text-gray-400'
              }`}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
            </div>
            <span
              className={`text-sm font-medium hidden sm:block ${
                isActive ? 'text-blue-600' : isDone ? 'text-gray-700' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-gray-300 mx-1" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function NewProgramPage() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdProgramId, setCreatedProgramId] = useState<string | null>(null)

  // Step 1 state
  const [programName, setProgramName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')

  // Step 2 state
  const [staffRows, setStaffRows] = useState<StaffRow[]>([
    { id: crypto.randomUUID(), full_name: '', email: '', school: '' },
  ])
  const [csvDragging, setCsvDragging] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvTab, setCsvTab] = useState('manual')

  // Step 3 state
  const [signees, setSignees] = useState<SigneeUser[]>([])
  const [signeesLoading, setSigneesLoading] = useState(false)
  const [selectedSigneeIds, setSelectedSigneeIds] = useState<Set<string>>(new Set())
  const [signeeMode, setSigneeMode] = useState<'all' | 'per-staff'>('all')
  const [perStaffSignees, setPerStaffSignees] = useState<Record<string, string>>({}) // staffRowId -> signeeId

  // Step 4 state
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([])
  const [payPeriodsLoading, setPayPeriodsLoading] = useState(false)
  const [selectedPayPeriods, setSelectedPayPeriods] = useState<SelectedPayPeriod[]>([])

  // ---------------------------------------------------------------------------
  // Data loaders
  // ---------------------------------------------------------------------------

  const loadSignees = useCallback(async () => {
    setSigneesLoading(true)
    try {
      const res = await fetch('/api/admin/users?role=signee')
      if (!res.ok) throw new Error('Failed to load signees')
      const data: SigneeUser[] = await res.json()
      setSignees(data)
    } catch (e) {
      console.error(e)
    } finally {
      setSigneesLoading(false)
    }
  }, [])

  const loadPayPeriods = useCallback(async () => {
    setPayPeriodsLoading(true)
    try {
      const res = await fetch('/api/admin/pay-periods')
      if (!res.ok) throw new Error('Failed to load pay periods')
      const data: PayPeriod[] = await res.json()
      setPayPeriods(data)
    } catch (e) {
      console.error(e)
    } finally {
      setPayPeriodsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step === 3) loadSignees()
    if (step === 4) loadPayPeriods()
  }, [step, loadSignees, loadPayPeriods])

  // ---------------------------------------------------------------------------
  // Step 2 helpers
  // ---------------------------------------------------------------------------

  function addStaffRow() {
    setStaffRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), full_name: '', email: '', school: '' },
    ])
  }

  function removeStaffRow(id: string) {
    setStaffRows((prev) => prev.filter((r) => r.id !== id))
  }

  function updateStaffRow(id: string, field: keyof Omit<StaffRow, 'id'>, value: string) {
    setStaffRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  function parseCSV(text: string) {
    setCsvError(null)
    const lines = text.trim().split('\n')
    if (lines.length < 2) {
      setCsvError('CSV must have a header row and at least one data row.')
      return
    }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const nameIdx = header.indexOf('full_name')
    const emailIdx = header.indexOf('email')
    const schoolIdx = header.indexOf('school')

    if (nameIdx === -1 || emailIdx === -1) {
      setCsvError('CSV must contain columns: full_name, email (school is optional).')
      return
    }

    const newRows: StaffRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const full_name = cols[nameIdx] ?? ''
      const email = cols[emailIdx] ?? ''
      const school = schoolIdx !== -1 ? (cols[schoolIdx] ?? '') : ''
      if (!full_name && !email) continue
      newRows.push({ id: crypto.randomUUID(), full_name, email, school })
    }

    if (newRows.length === 0) {
      setCsvError('No valid rows found in CSV.')
      return
    }

    setStaffRows((prev) => {
      const filtered = prev.filter((r) => r.full_name || r.email)
      return [...filtered, ...newRows]
    })
    setCsvTab('manual')
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      parseCSV(e.target?.result as string)
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setCsvDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleCsvFile(file)
  }

  // ---------------------------------------------------------------------------
  // Step 3 helpers
  // ---------------------------------------------------------------------------

  function toggleSignee(id: string) {
    setSelectedSigneeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Step 4 helpers
  // ---------------------------------------------------------------------------

  function togglePayPeriod(ppId: string) {
    setSelectedPayPeriods((prev) => {
      const exists = prev.find((p) => p.pay_period_id === ppId)
      if (exists) return prev.filter((p) => p.pay_period_id !== ppId)
      const pp = payPeriods.find((p) => p.id === ppId)
      const defaultDeadline = pp ? `${pp.end_date}T17:00` : ''
      return [...prev, { pay_period_id: ppId, submit_deadline: defaultDeadline }]
    })
  }

  function updateDeadline(ppId: string, value: string) {
    setSelectedPayPeriods((prev) =>
      prev.map((p) => (p.pay_period_id === ppId ? { ...p, submit_deadline: value } : p))
    )
  }

  function applyDefaultOffset(ppId: string) {
    const pp = payPeriods.find((p) => p.id === ppId)
    if (!pp) return
    // Default: 3 business days after end_date at 5pm
    const endDate = new Date(pp.end_date + 'T00:00:00')
    endDate.setDate(endDate.getDate() + 3)
    const iso = endDate.toISOString().slice(0, 10) + 'T17:00'
    updateDeadline(ppId, iso)
  }

  // ---------------------------------------------------------------------------
  // Validation and navigation
  // ---------------------------------------------------------------------------

  function validateStep1() {
    if (!programName.trim()) return 'Program name is required.'
    if (!accountNumber.trim()) return 'Account number is required.'
    return null
  }

  function validateStep2() {
    const validRows = staffRows.filter((r) => r.full_name.trim() || r.email.trim())
    if (validRows.length === 0) return 'Add at least one staff member.'
    for (const r of validRows) {
      if (!r.full_name.trim()) return `Email "${r.email}" is missing a name.`
      if (!r.email.trim()) return `"${r.full_name}" is missing an email.`
    }
    return null
  }

  function goNext() {
    setError(null)
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
    }
    if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }
    }
    setStep((s) => Math.min(s + 1, 4))
  }

  function goBack() {
    setError(null)
    setStep((s) => Math.max(s - 1, 1))
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)

    const validStaff = staffRows.filter((r) => r.full_name.trim() && r.email.trim())

    // Build signees payload
    let signeesPayload: SigneeAssignment[] = []
    if (signeeMode === 'all') {
      signeesPayload = Array.from(selectedSigneeIds).map((sid) => ({
        signee_id: sid,
        staff_id: null,
      }))
    } else {
      signeesPayload = Object.entries(perStaffSignees)
        .filter(([, signeeId]) => signeeId)
        .map(([staffRowId, signeeId]) => {
          const staffRow = validStaff.find((r) => r.id === staffRowId)
          return { signee_id: signeeId, staff_id: staffRow?.email ?? null }
        })
    }

    const body = {
      name: programName.trim(),
      account_number: accountNumber.trim(),
      staff: validStaff.map(({ full_name, email, school }) => ({ full_name, email, school })),
      signees: signeesPayload,
      pay_periods: selectedPayPeriods.map((p) => ({
        pay_period_id: p.pay_period_id,
        submit_deadline: p.submit_deadline
          ? new Date(p.submit_deadline).toISOString()
          : new Date().toISOString(),
      })),
    }

    try {
      const res = await fetch('/api/admin/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create program')
      }

      const created = await res.json()
      setCreatedProgramId(created.id)
      setSuccess(true)

      setTimeout(() => {
        router.push(`/admin/programs/${created.id}`)
      }, 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Success screen
  // ---------------------------------------------------------------------------

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold text-gray-900">Program Created!</h2>
        <p className="text-muted-foreground">
          Welcome emails are being sent. Redirecting to the program page...
        </p>
        <Spinner size="sm" />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create New Program</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow the steps below to set up a new NTL program.
        </p>
      </div>

      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 1: Program Info                                                */}
      {/* ------------------------------------------------------------------ */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Program Information</CardTitle>
            <CardDescription>Enter the basic details for this program.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program-name">
                Program Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="program-name"
                placeholder="e.g. After School Tutoring"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-number">
                Account Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="account-number"
                placeholder="e.g. 01-50-2100-5900"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 2: Add Staff                                                   */}
      {/* ------------------------------------------------------------------ */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Add Staff</CardTitle>
            <CardDescription>
              Enter staff manually or upload a CSV file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={csvTab} onValueChange={setCsvTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-3">
                {staffRows.map((row, idx) => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-4">
                      {idx === 0 && (
                        <Label className="text-xs mb-1 block">Full Name</Label>
                      )}
                      <Input
                        placeholder="Jane Smith"
                        value={row.full_name}
                        onChange={(e) =>
                          updateStaffRow(row.id, 'full_name', e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-4">
                      {idx === 0 && (
                        <Label className="text-xs mb-1 block">Email</Label>
                      )}
                      <Input
                        type="email"
                        placeholder="jane@nps.org"
                        value={row.email}
                        onChange={(e) =>
                          updateStaffRow(row.id, 'email', e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && (
                        <Label className="text-xs mb-1 block">School</Label>
                      )}
                      <Input
                        placeholder="School name"
                        value={row.school}
                        onChange={(e) =>
                          updateStaffRow(row.id, 'school', e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-1 flex items-end pb-0.5">
                      {idx === 0 && <div className="h-5" />}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => removeStaffRow(row.id)}
                        disabled={staffRows.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addStaffRow} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Row
                </Button>
              </TabsContent>

              <TabsContent value="csv">
                <div
                  className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                    csvDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setCsvDragging(true) }}
                  onDragLeave={() => setCsvDragging(false)}
                  onDrop={handleDrop}
                >
                  <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Drag &amp; drop a CSV file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Required columns:{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded">full_name</code>,{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded">email</code>
                    {' '}— optional:{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded">school</code>
                  </p>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    id="csv-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleCsvFile(file)
                    }}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      Choose File
                    </label>
                  </Button>
                  {csvError && (
                    <p className="mt-3 text-sm text-destructive">{csvError}</p>
                  )}
                </div>
                {staffRows.filter((r) => r.full_name || r.email).length > 0 && (
                  <p className="mt-3 text-sm text-green-600 font-medium">
                    {staffRows.filter((r) => r.full_name || r.email).length} staff member(s) loaded
                    — switch to Manual Entry to review.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 3: Assign Signees                                              */}
      {/* ------------------------------------------------------------------ */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Signees</CardTitle>
            <CardDescription>
              Select signees and choose how they are assigned to staff.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Signee selection */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Select Signees</Label>
              {signeesLoading ? (
                <Spinner size="sm" />
              ) : signees.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No signees found. Add users with the signee role first.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {signees.map((signee) => (
                    <div key={signee.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`signee-${signee.id}`}
                        checked={selectedSigneeIds.has(signee.id)}
                        onCheckedChange={() => toggleSignee(signee.id)}
                      />
                      <label
                        htmlFor={`signee-${signee.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        <span className="font-medium">{signee.full_name}</span>{' '}
                        <span className="text-muted-foreground">({signee.email})</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Assignment mode */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Assignment Mode</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="signee-mode"
                    value="all"
                    checked={signeeMode === 'all'}
                    onChange={() => setSigneeMode('all')}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-medium">All Staff</span>
                  <span className="text-xs text-muted-foreground">
                    — selected signees cover all staff in program
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="signee-mode"
                    value="per-staff"
                    checked={signeeMode === 'per-staff'}
                    onChange={() => setSigneeMode('per-staff')}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-medium">Per Staff</span>
                  <span className="text-xs text-muted-foreground">
                    — assign a specific signee to each staff member
                  </span>
                </label>
              </div>
            </div>

            {/* Per staff matrix */}
            {signeeMode === 'per-staff' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold block">Staff → Signee Assignments</Label>
                {staffRows
                  .filter((r) => r.full_name.trim() || r.email.trim())
                  .map((staffRow) => (
                    <div key={staffRow.id} className="flex items-center gap-4">
                      <span className="text-sm w-48 truncate" title={staffRow.full_name}>
                        {staffRow.full_name || staffRow.email}
                      </span>
                      <Select
                        value={perStaffSignees[staffRow.id] ?? ''}
                        onValueChange={(val) =>
                          setPerStaffSignees((prev) => ({ ...prev, [staffRow.id]: val }))
                        }
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select signee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {signees.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 4: Assign Pay Periods                                          */}
      {/* ------------------------------------------------------------------ */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Pay Periods</CardTitle>
            <CardDescription>
              Select pay periods and set submission deadlines for each.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payPeriodsLoading ? (
              <Spinner size="md" />
            ) : payPeriods.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No pay periods available. Create pay periods first.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {payPeriods.map((pp) => {
                  const selected = selectedPayPeriods.find(
                    (s) => s.pay_period_id === pp.id
                  )
                  const isSelected = !!selected
                  return (
                    <div
                      key={pp.id}
                      className={`border rounded-lg p-3 transition-colors ${
                        isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`pp-${pp.id}`}
                          checked={isSelected}
                          onCheckedChange={() => togglePayPeriod(pp.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={`pp-${pp.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {pp.label}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {pp.start_date} – {pp.end_date} &bull; FY {pp.fiscal_year}
                          </p>
                          {isSelected && (
                            <div className="mt-2 flex items-center gap-2">
                              <Label className="text-xs whitespace-nowrap">
                                Deadline:
                              </Label>
                              <Input
                                type="datetime-local"
                                className="h-8 text-xs"
                                value={selected.submit_deadline}
                                onChange={(e) =>
                                  updateDeadline(pp.id, e.target.value)
                                }
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-8 whitespace-nowrap"
                                onClick={() => applyDefaultOffset(pp.id)}
                              >
                                Apply Default
                              </Button>
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Navigation buttons                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={goBack} disabled={step === 1 || submitting}>
          Back
        </Button>
        <div className="flex gap-3">
          {step < 4 ? (
            <Button onClick={goNext}>Continue</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                'Create Program'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
