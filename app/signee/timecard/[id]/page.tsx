// =============================================================================
// app/signee/timecard/[id]/page.tsx
// Individual Timecard Signing — Server Component
// Read-only timecard view with conditional signature/reopen sections.
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, CheckCircle2, User, Calendar, FileText } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { SignTimecardForm } from '@/components/timecards/sign-timecard-form'
import { ReopenRequestHandler } from '@/components/timecards/reopen-request-handler'
import type { TimecardStatus } from '@/types/app.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '—'
  try {
    // HH:MM:SS → 12-hour format
    const [hh, mm] = timeStr.split(':').map(Number)
    const period = hh >= 12 ? 'PM' : 'AM'
    const hour = hh % 12 || 12
    return `${hour}:${String(mm).padStart(2, '0')} ${period}`
  } catch {
    return timeStr
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy h:mm a')
  } catch {
    return dateStr
  }
}

function StatusLabel({ status }: { status: TimecardStatus }) {
  switch (status) {
    case 'submitted':
      return <Badge variant="warning">Awaiting Signature</Badge>
    case 'signed':
      return <Badge variant="success">Signed</Badge>
    case 'reopen_requested':
      return <Badge variant="warning">Reopen Requested</Badge>
    case 'reopened':
      return <Badge variant="info">Reopened</Badge>
    case 'draft':
      return <Badge variant="secondary">Draft</Badge>
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

export default async function SigneeTimecardPage({ params }: PageProps) {
  const { id: timecardId } = await params
  const supabase = await createClient()

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // 1. Fetch the timecard with joins
  const { data: timecard, error: tcError } = await supabase
    .from('timecards')
    .select(`
      id, program_id, pay_period_id, staff_id, status,
      submitted_at, staff_signature, staff_signed_at,
      signee_id, signee_signature, signee_signed_at,
      reopen_reason, reopen_approved_by, reopen_approved_at,
      created_at, updated_at,
      programs!inner(id, name, account_number),
      pay_periods!inner(id, label, start_date, end_date),
      users!timecards_staff_id_fkey(id, full_name, email)
    `)
    .eq('id', timecardId)
    .single()

  if (tcError || !timecard) notFound()

  type TimecardFull = typeof timecard & {
    programs: { id: string; name: string; account_number: string }
    pay_periods: { id: string; label: string; start_date: string; end_date: string }
    users: { id: string; full_name: string; email: string }
  }

  const tc = timecard as unknown as TimecardFull

  // 2. Validate signee access
  const { data: signeeRow } = await supabase
    .from('program_signees')
    .select('id')
    .eq('signee_id', user.id)
    .eq('program_id', tc.program_id)
    .or(`staff_id.is.null,staff_id.eq.${tc.staff_id}`)
    .limit(1)
    .single()

  if (!signeeRow) {
    // No access — redirect to dashboard
    redirect('/signee')
  }

  // 3. Fetch timecard entries
  const { data: entries } = await supabase
    .from('timecard_entries')
    .select('id, work_date, time_in, time_out, total_hours')
    .eq('timecard_id', timecardId)
    .order('work_date', { ascending: true })

  const allEntries = entries ?? []

  // Calculate totals
  const totalHours = allEntries.reduce((sum, e) => sum + e.total_hours, 0)

  // 4. Fetch signee user info (if already signed)
  let signeeName: string | null = null
  if (tc.signee_id) {
    const { data: signeeUser } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', tc.signee_id)
      .single()
    signeeName = signeeUser?.full_name ?? null
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const program = tc.programs
  const payPeriod = tc.pay_periods
  const staffUser = tc.users

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Back link */}
      <div>
        <Link
          href={`/signee/program/${program.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to {program.name}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Timecard Review</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review all details before signing.
            </p>
          </div>
          <StatusLabel status={tc.status as TimecardStatus} />
        </div>
      </div>

      {/* Timecard Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Timecard Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Staff Member
            </p>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{staffUser.full_name}</p>
            </div>
            <p className="text-xs text-muted-foreground">{staffUser.email}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Program
            </p>
            <p className="font-medium">{program.name}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {program.account_number}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pay Period
            </p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">{payPeriod.label}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(payPeriod.start_date)} – {formatDate(payPeriod.end_date)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Submitted
            </p>
            <p className="font-medium">{formatDateTime(tc.submitted_at)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {allEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">
              No time entries recorded.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {formatDate(entry.work_date)}
                      </TableCell>
                      <TableCell>{formatTime(entry.time_in)}</TableCell>
                      <TableCell>{formatTime(entry.time_out)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.total_hours.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator className="my-3" />
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-gray-700">
                  Total Hours
                </span>
                <span className="text-lg font-bold text-gray-900 font-mono">
                  {totalHours.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Staff Signature Card */}
      {tc.staff_signature && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff Signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="font-medium italic text-gray-800">
              &ldquo;{tc.staff_signature}&rdquo;
            </p>
            <p className="text-xs text-muted-foreground">
              Signed on {formatDateTime(tc.staff_signed_at)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Signed status — if already signed */}
      {tc.status === 'signed' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-green-800">Timecard Signed</p>
              {signeeName && (
                <p className="text-sm text-green-700">
                  Signed by <strong>{signeeName}</strong>
                </p>
              )}
              {tc.signee_signature && (
                <p className="text-sm text-green-700 italic">
                  Signature: &ldquo;{tc.signee_signature}&rdquo;
                </p>
              )}
              <p className="text-sm text-green-700">
                Signed on {formatDateTime(tc.signee_signed_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Signature form — if status is submitted */}
      {tc.status === 'submitted' && (
        <SignTimecardForm
          timecardId={timecardId}
          staffName={staffUser.full_name}
          programName={program.name}
          payPeriodLabel={payPeriod.label}
          programId={program.id}
        />
      )}

      {/* Reopen request handler — if status is reopen_requested */}
      {tc.status === 'reopen_requested' && (
        <ReopenRequestHandler
          timecardId={timecardId}
          staffName={staffUser.full_name}
          reason={tc.reopen_reason ?? ''}
          programId={program.id}
        />
      )}
    </div>
  )
}
