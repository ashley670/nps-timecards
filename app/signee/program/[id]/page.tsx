// =============================================================================
// app/signee/program/[id]/page.tsx
// Signee Program View — Server Component
// Shows all staff assigned to this signee in this program, with their timecards.
// =============================================================================

import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  PenLine,
  RotateCcw,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { TimecardStatus } from '@/types/app.types'

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

function StatusBadge({ status }: { status: TimecardStatus }) {
  switch (status) {
    case 'draft':
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 h-3 w-3" />
          Draft
        </Badge>
      )
    case 'submitted':
      return (
        <Badge variant="warning">
          <PenLine className="mr-1 h-3 w-3" />
          Awaiting Signature
        </Badge>
      )
    case 'signed':
      return (
        <Badge variant="success">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Signed
        </Badge>
      )
    case 'reopen_requested':
      return (
        <Badge variant="warning">
          <AlertCircle className="mr-1 h-3 w-3" />
          Reopen Requested
        </Badge>
      )
    case 'reopened':
      return (
        <Badge variant="info">
          <RotateCcw className="mr-1 h-3 w-3" />
          Reopened
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SigneeProgramPage({ params }: PageProps) {
  const { id: programId } = await params
  const supabase = await createClient()

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // 1. Fetch the program
  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('id, name, account_number')
    .eq('id', programId)
    .single()

  if (programError || !program) notFound()

  // 2. Fetch program_signees rows for this signee+program
  const { data: signeeRows } = await supabase
    .from('program_signees')
    .select('staff_id')
    .eq('signee_id', user.id)
    .eq('program_id', programId)

  if (!signeeRows || signeeRows.length === 0) {
    // Not authorized for this program
    redirect('/signee')
  }

  // Determine which staff IDs this signee can see
  // null staff_id means the signee covers ALL staff in the program
  const coversAll = signeeRows.some((r) => r.staff_id === null)
  const specificStaffIds = signeeRows
    .filter((r) => r.staff_id !== null)
    .map((r) => r.staff_id as string)

  // 3. Fetch all staff in this program
  const { data: programStaffRows } = await supabase
    .from('program_staff')
    .select('staff_id, school, users!inner(id, full_name, email)')
    .eq('program_id', programId)

  type StaffRow = {
    staff_id: string
    school: string
    users: { id: string; full_name: string; email: string }
  }

  const allProgramStaff = (programStaffRows ?? []) as unknown as StaffRow[]

  // Filter to only staff this signee can see
  const visibleStaff = coversAll
    ? allProgramStaff
    : allProgramStaff.filter((s) => specificStaffIds.includes(s.staff_id))

  // 4. Fetch all timecards for this program for visible staff
  const visibleStaffIds = visibleStaff.map((s) => s.staff_id)

  const { data: timecards } = visibleStaffIds.length
    ? await supabase
        .from('timecards')
        .select(`
          id, staff_id, status, submitted_at, signee_signed_at, reopen_reason,
          pay_periods!inner(id, label, start_date, end_date)
        `)
        .eq('program_id', programId)
        .in('staff_id', visibleStaffIds)
        .order('submitted_at', { ascending: false })
    : { data: [] }

  type TimecardRow = {
    id: string
    staff_id: string
    status: TimecardStatus
    submitted_at: string | null
    signee_signed_at: string | null
    reopen_reason: string | null
    pay_periods: {
      id: string
      label: string
      start_date: string
      end_date: string
    }
  }

  const allTimecards = (timecards ?? []) as unknown as TimecardRow[]

  // Group timecards by staff_id
  const timecardsByStaff: Record<string, TimecardRow[]> = {}
  for (const tc of allTimecards) {
    if (!timecardsByStaff[tc.staff_id]) timecardsByStaff[tc.staff_id] = []
    timecardsByStaff[tc.staff_id].push(tc)
  }

  // Count pending (submitted) timecards across all staff
  const totalPending = allTimecards.filter((tc) => tc.status === 'submitted').length
  const reopenRequests = allTimecards.filter((tc) => tc.status === 'reopen_requested').length

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Back link + heading */}
      <div>
        <Link
          href="/signee"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground font-mono">
              {program.account_number}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {totalPending > 0 && (
              <Badge variant="warning">
                {totalPending} pending signature{totalPending !== 1 ? 's' : ''}
              </Badge>
            )}
            {reopenRequests > 0 && (
              <Badge variant="warning">
                <AlertCircle className="mr-1 h-3 w-3" />
                {reopenRequests} reopen request{reopenRequests !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Staff sections */}
      {visibleStaff.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-base font-medium text-gray-700">No staff assigned</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No staff members have been assigned to you in this program.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleStaff.map((staffRow) => {
            const staffTimecards = timecardsByStaff[staffRow.staff_id] ?? []
            const staffPending = staffTimecards.filter(
              (tc) => tc.status === 'submitted'
            ).length
            const staffReopens = staffTimecards.filter(
              (tc) => tc.status === 'reopen_requested'
            ).length

            return (
              <Card key={staffRow.staff_id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {staffRow.users.full_name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {staffRow.school}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {staffReopens > 0 && (
                        <Badge variant="warning">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Reopen request
                        </Badge>
                      )}
                      {staffPending > 0 && (
                        <Badge variant="warning">
                          {staffPending} pending
                        </Badge>
                      )}
                      {staffPending === 0 && staffReopens === 0 && staffTimecards.length > 0 && (
                        <Badge variant="success">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          All signed
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {staffTimecards.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-4">
                      No timecards submitted yet for this program.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pay Period</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffTimecards.map((tc) => (
                          <TableRow key={tc.id}>
                            <TableCell className="font-medium">
                              {tc.pay_periods.label}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(tc.pay_periods.start_date)} –{' '}
                              {formatDate(tc.pay_periods.end_date)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {tc.submitted_at
                                ? formatDate(tc.submitted_at)
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={tc.status} />
                              {tc.status === 'reopen_requested' &&
                                tc.reopen_reason && (
                                  <p className="mt-1 text-xs text-muted-foreground max-w-xs truncate">
                                    {tc.reopen_reason}
                                  </p>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                              {(tc.status === 'submitted' ||
                                tc.status === 'reopen_requested') && (
                                <Button size="sm" asChild>
                                  <Link href={`/signee/timecard/${tc.id}`}>
                                    {tc.status === 'reopen_requested'
                                      ? 'Review Request'
                                      : 'Sign'}
                                  </Link>
                                </Button>
                              )}
                              {tc.status === 'signed' && (
                                <Button size="sm" variant="ghost" asChild>
                                  <Link href={`/signee/timecard/${tc.id}`}>
                                    View
                                  </Link>
                                </Button>
                              )}
                              {(tc.status === 'draft' || tc.status === 'reopened') && (
                                <span className="text-xs text-muted-foreground">
                                  Not yet submitted
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
