// =============================================================================
// app/dashboard/program/[id]/page.tsx
// Program Pay Periods — Server Component
// Lists all pay periods for a program with timecard status per period.
// =============================================================================

import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatDateRange, isDeadlineSoon, isDeadlinePast } from '@/lib/utils'
import type { TimecardStatus } from '@/types/app.types'
import StartTimecardButton from './start-timecard-button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PayPeriodRow {
  programPayPeriodId: string
  payPeriodId: string
  label: string
  startDate: string
  endDate: string
  submitDeadline: string
  timecardId: string | null
  timecardStatus: TimecardStatus | null
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function statusVariant(
  status: TimecardStatus | null
): 'outline' | 'warning' | 'info' | 'success' | 'default' | 'destructive' | 'secondary' {
  if (!status) return 'outline'
  switch (status) {
    case 'draft':
      return 'warning'
    case 'submitted':
      return 'info'
    case 'signed':
      return 'success'
    case 'reopen_requested':
      return 'warning'
    case 'reopened':
      return 'secondary'
    default:
      return 'outline'
  }
}

function statusLabel(status: TimecardStatus | null): string {
  if (!status) return 'Not Started'
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'submitted':
      return 'Submitted'
    case 'signed':
      return 'Signed'
    case 'reopen_requested':
      return 'Reopen Requested'
    case 'reopened':
      return 'Reopened'
    default:
      return status
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProgramPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const programId = params.id

  // 2. Verify this staff member belongs to the program
  const { data: staffMembership } = await supabase
    .from('program_staff')
    .select('id')
    .eq('program_id', programId)
    .eq('staff_id', user.id)
    .single()

  if (!staffMembership) {
    notFound()
  }

  // 3. Fetch program details
  const { data: program } = await supabase
    .from('programs')
    .select('id, name, account_number')
    .eq('id', programId)
    .single()

  if (!program) {
    notFound()
  }

  // 4. Fetch program_pay_periods with pay_period details
  const { data: pppRows } = await supabase
    .from('program_pay_periods')
    .select(`
      id,
      pay_period_id,
      submit_deadline,
      pay_periods (
        id,
        label,
        start_date,
        end_date,
        fiscal_year
      )
    `)
    .eq('program_id', programId)
    .order('submit_deadline', { ascending: false })

  const payPeriodIds = (pppRows ?? []).map((r) => r.pay_period_id)

  // 5. Fetch existing timecards for this user + program
  const { data: timecards } = await supabase
    .from('timecards')
    .select('id, pay_period_id, status')
    .eq('staff_id', user.id)
    .eq('program_id', programId)
    .in('pay_period_id', payPeriodIds.length > 0 ? payPeriodIds : ['__none__'])

  const timecardMap = Object.fromEntries(
    (timecards ?? []).map((tc) => [
      tc.pay_period_id,
      { id: tc.id, status: tc.status as TimecardStatus },
    ])
  )

  // 6. Build rows
  const rows: PayPeriodRow[] = (pppRows ?? []).map((ppp) => {
    const pp = ppp.pay_periods as unknown as {
      id: string
      label: string
      start_date: string
      end_date: string
    }
    const tc = timecardMap[ppp.pay_period_id] ?? null

    return {
      programPayPeriodId: ppp.id,
      payPeriodId: ppp.pay_period_id,
      label: pp?.label ?? '',
      startDate: pp?.start_date ?? '',
      endDate: pp?.end_date ?? '',
      submitDeadline: ppp.submit_deadline,
      timecardId: tc?.id ?? null,
      timecardStatus: tc?.status ?? null,
    }
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to Dashboard
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Account: {program.account_number}</p>
      </div>

      {/* Pay periods list */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            No pay periods have been assigned to this program yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const pastDue = row.submitDeadline ? isDeadlinePast(row.submitDeadline) : false
            const soon = row.submitDeadline ? isDeadlineSoon(row.submitDeadline) : false
            const deadlineUrgent = pastDue || soon

            return (
              <Card key={row.programPayPeriodId}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Period info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{row.label}</p>
                      <Badge variant={statusVariant(row.timecardStatus)}>
                        {statusLabel(row.timecardStatus)}
                      </Badge>
                    </div>
                    {row.startDate && row.endDate && (
                      <p className="text-sm text-gray-500">
                        {formatDateRange(row.startDate, row.endDate)}
                      </p>
                    )}
                    {row.submitDeadline && (
                      <p
                        className={`text-xs ${
                          deadlineUrgent ? 'font-semibold text-red-600' : 'text-gray-400'
                        }`}
                      >
                        Deadline: {formatDate(row.submitDeadline)}
                        {pastDue && ' — OVERDUE'}
                        {!pastDue && soon && ' — Due soon'}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    {row.timecardStatus === null ? (
                      <StartTimecardButton
                        programId={programId}
                        payPeriodId={row.payPeriodId}
                      />
                    ) : (
                      <Link href={`/dashboard/timecard/${row.timecardId}`}>
                        <Button variant="outline" size="sm">
                          View Timecard
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
