'use client'

// =============================================================================
// components/timecards/timecard-form.tsx
// Core timecard entry form — client component.
// Handles daily time entries, save-draft, submit with signature dialog,
// request-reopen flow, and read-only view mode.
// =============================================================================

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDateRange } from '@/lib/utils'
import type { Timecard, TimecardEntry, Program, PayPeriod, User } from '@/types/app.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimecardFormProps {
  timecard: Timecard
  entries: TimecardEntry[]
  program: Program
  payPeriod: PayPeriod
  staffUser: User
  ntlRate: number
  mode: 'edit' | 'view'
}

interface EntryState {
  date: string      // YYYY-MM-DD
  time_in: string   // HH:MM (24h)
  time_out: string  // HH:MM (24h)
  total_hours: number
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function calculateHours(timeIn: string, timeOut: string): number {
  if (!timeIn || !timeOut) return 0
  const [inH, inM] = timeIn.split(':').map(Number)
  const [outH, outM] = timeOut.split(':').map(Number)
  const diff = (outH * 60 + outM) - (inH * 60 + inM)
  return Math.max(0, Math.round(diff / 60 * 100) / 100)
}

function getDaysInPeriod(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

/** Convert "HH:MM:SS" or "HH:MM" to "HH:MM" (24h) */
function toHHMM(t: string | null | undefined): string {
  if (!t) return ''
  const parts = t.split(':')
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  }
  return ''
}

/** Format 24h "HH:MM" as "h:mm AM/PM" */
function to12h(hhmm: string): string {
  if (!hhmm) return '—'
  const [hStr, mStr] = hhmm.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return hhmm
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), 'EEE, MMM d')
  } catch {
    return iso
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'draft': return 'Draft'
    case 'submitted': return 'Submitted'
    case 'signed': return 'Signed'
    case 'reopen_requested': return 'Reopen Requested'
    case 'reopened': return 'Reopened'
    default: return status
  }
}

function statusVariant(
  status: string
): 'outline' | 'warning' | 'info' | 'success' | 'default' | 'destructive' | 'secondary' {
  switch (status) {
    case 'draft': return 'warning'
    case 'submitted': return 'info'
    case 'signed': return 'success'
    case 'reopen_requested': return 'warning'
    case 'reopened': return 'secondary'
    default: return 'outline'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimecardForm({
  timecard,
  entries,
  program,
  payPeriod,
  staffUser,
  ntlRate,
  mode,
}: TimecardFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  // Build initial entry state from all days in the period
  const allDays = getDaysInPeriod(payPeriod.start_date, payPeriod.end_date)
  const entryMap = Object.fromEntries(
    entries.map((e) => [e.work_date, e])
  )

  const [entryStates, setEntryStates] = useState<EntryState[]>(
    allDays.map((date) => {
      const existing = entryMap[date]
      return {
        date,
        time_in: toHHMM(existing?.time_in),
        time_out: toHHMM(existing?.time_out),
        total_hours: existing?.total_hours ?? 0,
      }
    })
  )

  // Submit dialog state
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [signature, setSignature] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reopen state
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [reopening, setReopening] = useState(false)

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const totalHours = entryStates.reduce((sum, e) => sum + e.total_hours, 0)
  const estimatedPay = totalHours * ntlRate

  // ---------------------------------------------------------------------------
  // Entry handlers
  // ---------------------------------------------------------------------------

  const updateEntry = useCallback(
    (index: number, field: 'time_in' | 'time_out', value: string) => {
      setEntryStates((prev) => {
        const next = [...prev]
        const updated = { ...next[index], [field]: value }
        updated.total_hours = calculateHours(
          field === 'time_in' ? value : updated.time_in,
          field === 'time_out' ? value : updated.time_out
        )
        next[index] = updated
        return next
      })
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Build entries payload (only rows with time data)
  // ---------------------------------------------------------------------------

  function buildEntriesPayload() {
    return entryStates
      .filter((e) => e.time_in && e.time_out)
      .map((e) => ({
        work_date: e.date,
        time_in: e.time_in + ':00',
        time_out: e.time_out + ':00',
        total_hours: e.total_hours,
      }))
  }

  // ---------------------------------------------------------------------------
  // Save draft
  // ---------------------------------------------------------------------------

  async function handleSaveDraft() {
    setSaving(true)
    try {
      const res = await fetch(`/api/timecards/${timecard.id}/entries`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: buildEntriesPayload() }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to save draft')
      }

      toast({ title: 'Draft saved', description: 'Your timecard has been saved.' })
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not save.',
        variant: 'destructive',
      })
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Submit timecard
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    if (!signature.trim()) {
      toast({
        title: 'Signature required',
        description: 'Please type your full name to sign the timecard.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/timecards/${timecard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          entries: buildEntriesPayload(),
          staff_signature: signature.trim(),
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to submit timecard')
      }

      setSubmitDialogOpen(false)
      toast({
        title: 'Timecard submitted',
        description: 'Your timecard has been submitted.',
      })
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Could not submit.',
        variant: 'destructive',
      })
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Request reopen
  // ---------------------------------------------------------------------------

  async function handleReopenRequest() {
    if (!reopenReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for your reopen request.',
        variant: 'destructive',
      })
      return
    }

    setReopening(true)
    try {
      const res = await fetch(`/api/timecards/${timecard.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reopenReason.trim() }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to submit reopen request')
      }

      setReopenDialogOpen(false)
      toast({
        title: 'Reopen request sent',
        description: 'Your request has been sent to the signee for review.',
      })
      router.refresh()
    } catch (err) {
      toast({
        title: 'Request failed',
        description: err instanceof Error ? err.message : 'Could not submit request.',
        variant: 'destructive',
      })
      setReopening(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      {/* Back link */}
      <a
        href="/dashboard"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to Dashboard
      </a>

      {/* Reopened banner */}
      {timecard.status === 'reopened' && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <strong>Reopened:</strong> This timecard was reopened
          {timecard.reopen_approved_by && (
            <>
              {' '}as approved
              {timecard.reopen_approved_at && (
                <> on {format(new Date(timecard.reopen_approved_at), 'MMM d, yyyy')}</>
              )}
            </>
          )}
          . Please make your corrections and resubmit.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* READ-ONLY HEADER                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{program.name}</CardTitle>
              <p className="mt-0.5 text-sm text-gray-500">Account: {program.account_number}</p>
            </div>
            <Badge variant={statusVariant(timecard.status)}>
              {statusLabel(timecard.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="font-medium text-gray-600">Staff Name:</span>{' '}
            <span>{staffUser.full_name}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Pay Period:</span>{' '}
            <span>
              {formatDateRange(payPeriod.start_date, payPeriod.end_date)}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Mailing Address:</span>{' '}
            <span>{staffUser.address ?? '—'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Period Label:</span>{' '}
            <span>{payPeriod.label}</span>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* DAILY ENTRY TABLE                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily Hours</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time In</th>
                <th className="px-4 py-3">Time Out</th>
                <th className="px-4 py-3 text-right">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entryStates.map((entry, i) => (
                <tr
                  key={entry.date}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                >
                  <td className="px-4 py-2 text-gray-700">{fmtDate(entry.date)}</td>

                  {/* Time In */}
                  <td className="px-4 py-2">
                    {mode === 'edit' ? (
                      <input
                        type="time"
                        value={entry.time_in}
                        onChange={(e) => updateEntry(i, 'time_in', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        aria-label={`Time in for ${entry.date}`}
                      />
                    ) : (
                      <span className="text-gray-700">{to12h(entry.time_in)}</span>
                    )}
                  </td>

                  {/* Time Out */}
                  <td className="px-4 py-2">
                    {mode === 'edit' ? (
                      <input
                        type="time"
                        value={entry.time_out}
                        onChange={(e) => updateEntry(i, 'time_out', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        aria-label={`Time out for ${entry.date}`}
                      />
                    ) : (
                      <span className="text-gray-700">{to12h(entry.time_out)}</span>
                    )}
                  </td>

                  {/* Total hours */}
                  <td className="px-4 py-2 text-right font-medium text-gray-800">
                    {entry.total_hours > 0 ? entry.total_hours.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* TOTALS SECTION                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm text-blue-600 font-medium">Total Hours for Pay Period</p>
            <p className="text-3xl font-bold text-blue-900">{totalHours.toFixed(2)} hrs</p>
          </div>
          {ntlRate > 0 && (
            <div className="text-right">
              <p className="text-sm text-blue-600 font-medium">Estimated Pay</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(estimatedPay)}</p>
              <p className="text-xs text-blue-400">at {formatCurrency(ntlRate)}/hr</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* SIGNED VIEW — signature details                                      */}
      {/* ------------------------------------------------------------------ */}
      {timecard.status === 'signed' && timecard.signee_signature && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Signatures</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Employee Signature
              </p>
              <p className="font-medium italic text-gray-800">
                {timecard.staff_signature ?? '—'}
              </p>
              {timecard.staff_signed_at && (
                <p className="text-xs text-gray-400">
                  {format(new Date(timecard.staff_signed_at), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Signee Signature
              </p>
              <p className="font-medium italic text-gray-800">
                {timecard.signee_signature}
              </p>
              {timecard.signee_signed_at && (
                <p className="text-xs text-gray-400">
                  {format(new Date(timecard.signee_signed_at), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ACTION BUTTONS                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3">
        {mode === 'edit' && (
          <>
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving || submitting}>
              {saving ? 'Saving…' : 'Save & Close'}
            </Button>
            <Button onClick={() => setSubmitDialogOpen(true)} disabled={saving || submitting}>
              Submit Timecard
            </Button>
          </>
        )}

        {mode === 'view' &&
          (timecard.status === 'submitted' || timecard.status === 'reopen_requested') && (
            <Button
              variant="outline"
              onClick={() => {
                setReopenReason('')
                setReopenDialogOpen(true)
              }}
              disabled={timecard.status === 'reopen_requested'}
            >
              {timecard.status === 'reopen_requested'
                ? 'Reopen Requested'
                : 'Request Edit Access'}
            </Button>
          )}

        {mode === 'view' && timecard.status === 'signed' && (
          <Button
            variant="outline"
            onClick={() => {
              setReopenReason('')
              setReopenDialogOpen(true)
            }}
          >
            Request Edit Access
          </Button>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SUBMIT CONFIRMATION DIALOG                                           */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Timecard</DialogTitle>
            <DialogDescription>
              Are you sure this timecard is accurate and complete based on the hours you worked
              this pay period? This action will send the timecard to your signee for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="staff-signature">
                Type your full name to sign:
              </Label>
              <Input
                id="staff-signature"
                className="mt-1"
                placeholder={staffUser.full_name}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                disabled={submitting}
              />
            </div>
            <p className="text-xs text-gray-500">
              By typing your name above you are certifying that the information entered is true
              and correct to the best of your knowledge.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSubmitDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !signature.trim()}>
              {submitting ? 'Submitting…' : 'Confirm & Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* REOPEN REQUEST DIALOG                                                */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Edit Access</DialogTitle>
            <DialogDescription>
              Please provide a reason for your reopen request. Your signee will review this
              request and either approve or deny it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="reopen-reason">Reason for request:</Label>
            <Textarea
              id="reopen-reason"
              rows={3}
              placeholder="Describe why you need to edit this timecard…"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              disabled={reopening}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setReopenDialogOpen(false)}
              disabled={reopening}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReopenRequest}
              disabled={reopening || !reopenReason.trim()}
            >
              {reopening ? 'Sending…' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
