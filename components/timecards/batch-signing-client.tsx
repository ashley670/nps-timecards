'use client'

// =============================================================================
// components/timecards/batch-signing-client.tsx
// Batch signing UI — Client Component
// Displays all pending timecards as paginated cards with checkboxes.
// Submits selected timecards in one batch signing call.
// =============================================================================

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { Spinner } from '@/components/ui/spinner'
import { PenLine, CheckCircle2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchTimecard {
  id: string
  program_id: string
  staff_id: string
  status: string
  submitted_at: string | null
  programs: { id: string; name: string }
  pay_periods: { id: string; label: string; start_date: string; end_date: string }
  users: { id: string; full_name: string }
  timecard_entries: {
    id: string
    work_date: string
    time_in: string
    time_out: string
    total_hours: number
  }[]
}

interface BatchSigningClientProps {
  timecards: BatchTimecard[]
  signeeName: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

function formatTime(timeStr: string): string {
  try {
    const [hh, mm] = timeStr.split(':').map(Number)
    const period = hh >= 12 ? 'PM' : 'AM'
    const hour = hh % 12 || 12
    return `${hour}:${String(mm).padStart(2, '0')} ${period}`
  } catch {
    return timeStr
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BatchSigningClient({ timecards, signeeName }: BatchSigningClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(timecards.map((tc) => tc.id))
  )
  const [signature, setSignature] = useState(signeeName)
  const [loading, setLoading] = useState(false)

  const allSelected = selectedIds.size === timecards.length
  const noneSelected = selectedIds.size === 0

  const selectedTimecards = useMemo(
    () => timecards.filter((tc) => selectedIds.has(tc.id)),
    [timecards, selectedIds]
  )

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(timecards.map((tc) => tc.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  async function handleBatchSign() {
    const trimmed = signature.trim()
    if (!trimmed) {
      toast({
        title: 'Signature required',
        description: 'Please enter your full name to sign.',
        variant: 'destructive',
      })
      return
    }

    if (noneSelected) {
      toast({
        title: 'No timecards selected',
        description: 'Please select at least one timecard to sign.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/signee/timecards/batch-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timecardIds: Array.from(selectedIds),
          signature: trimmed,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to sign timecards')
      }

      const result = await res.json()
      const count: number = result.signed ?? selectedIds.size

      toast({
        title: `${count} timecard${count !== 1 ? 's' : ''} signed successfully`,
        description: 'All selected timecards have been signed.',
      })

      router.push('/signee')
      router.refresh()
    } catch (err) {
      toast({
        title: 'Error signing timecards',
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Select All + Signature Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Checkbox
            id="select-all"
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
          <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
            Select All ({timecards.length} timecard{timecards.length !== 1 ? 's' : ''})
          </Label>
        </div>

        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="batch-signature" className="text-sm font-medium">
              Your full name (signature):
            </Label>
            <Input
              id="batch-signature"
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Type your full name"
              className="w-64"
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleBatchSign}
            disabled={loading || noneSelected || !signature.trim()}
            className="min-w-[180px]"
          >
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Signing…
              </>
            ) : (
              <>
                <PenLine className="mr-2 h-4 w-4" />
                Sign Selected ({selectedIds.size})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Timecard cards */}
      <div className="space-y-4">
        {timecards.map((tc) => {
          const isSelected = selectedIds.has(tc.id)
          const totalHours = tc.timecard_entries.reduce(
            (sum, e) => sum + e.total_hours,
            0
          )

          return (
            <Card
              key={tc.id}
              className={`transition-all ${
                isSelected
                  ? 'border-blue-300 shadow-sm ring-1 ring-blue-200'
                  : 'opacity-60'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`tc-${tc.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      toggleOne(tc.id, checked === true)
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1 flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        {tc.users.full_name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tc.programs.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="warning">Awaiting Signature</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tc.pay_periods.label}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {tc.timecard_entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-3">
                    No time entries recorded.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      Pay period:{' '}
                      {formatDate(tc.pay_periods.start_date)} –{' '}
                      {formatDate(tc.pay_periods.end_date)}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Time In</TableHead>
                          <TableHead className="text-xs">Time Out</TableHead>
                          <TableHead className="text-right text-xs">
                            Hours
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tc.timecard_entries.map((entry) => (
                          <TableRow key={entry.id} className="text-sm">
                            <TableCell>{formatDate(entry.work_date)}</TableCell>
                            <TableCell>{formatTime(entry.time_in)}</TableCell>
                            <TableCell>{formatTime(entry.time_out)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {entry.total_hours.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Total
                      </span>
                      <span className="text-sm font-bold font-mono">
                        {totalHours.toFixed(2)} hrs
                      </span>
                    </div>
                  </>
                )}

                {isSelected && signature.trim() && (
                  <div className="mt-4 flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-800">
                      Will be signed as:{' '}
                      <span className="font-semibold italic">{signature.trim()}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Bottom action bar (sticky summary) */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-10">
          <div className="rounded-lg border border-blue-200 bg-blue-600 text-white px-5 py-3 shadow-lg flex items-center justify-between gap-4">
            <p className="text-sm font-medium">
              {selectedIds.size} timecard{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
            <Button
              variant="secondary"
              onClick={handleBatchSign}
              disabled={loading || !signature.trim()}
              className="min-w-[160px]"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Signing…
                </>
              ) : (
                <>
                  <PenLine className="mr-2 h-4 w-4" />
                  Sign Selected ({selectedIds.size})
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
