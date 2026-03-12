// =============================================================================
// app/signee/page.tsx
// Signee Dashboard — Server Component
// Shows pending signature count, next deadline, and program folders.
// =============================================================================

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardList, Clock, FolderOpen, CheckCircle2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDeadline(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SigneeDashboardPage() {
  const supabase = await createClient()

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // 1. Fetch all program_signees rows for this user
  const { data: signeeRows, error: signeeError } = await supabase
    .from('program_signees')
    .select('program_id, staff_id')
    .eq('signee_id', user.id)

  if (signeeError) {
    console.error('[signee/page]', signeeError)
  }

  const programIds = Array.from(
    new Set((signeeRows ?? []).map((r) => r.program_id))
  )

  // 2. Fetch programs
  const { data: programs } = programIds.length
    ? await supabase
        .from('programs')
        .select('id, name, account_number')
        .in('id', programIds)
        .eq('is_active', true)
        .order('name')
    : { data: [] }

  // 3. Fetch all submitted timecards for programs where signee is assigned
  //    We apply the access rule in JS after fetching.
  const { data: allTimecards } = programIds.length
    ? await supabase
        .from('timecards')
        .select('id, program_id, staff_id, status')
        .in('program_id', programIds)
        .eq('status', 'submitted')
    : { data: [] }

  // Filter timecards this signee can actually see
  function signeeCanSee(tc: { program_id: string; staff_id: string }): boolean {
    return (signeeRows ?? []).some(
      (r) =>
        r.program_id === tc.program_id &&
        (r.staff_id === null || r.staff_id === tc.staff_id)
    )
  }

  const visibleTimecards = (allTimecards ?? []).filter(signeeCanSee)
  const pendingCount = visibleTimecards.length

  // 4. Build per-program pending counts
  const pendingByProgram: Record<string, number> = {}
  for (const tc of visibleTimecards) {
    pendingByProgram[tc.program_id] = (pendingByProgram[tc.program_id] ?? 0) + 1
  }

  // 5. Find nearest upcoming submit deadline across all programs
  //    program_pay_periods.submit_deadline is a future date/datetime string
  const { data: deadlines } = programIds.length
    ? await supabase
        .from('program_pay_periods')
        .select('submit_deadline, program_id')
        .in('program_id', programIds)
        .gte('submit_deadline', new Date().toISOString())
        .order('submit_deadline', { ascending: true })
        .limit(1)
    : { data: [] }

  const nextDeadline =
    deadlines && deadlines.length > 0 ? deadlines[0].submit_deadline : null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Signee Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and sign timecards submitted by staff in your programs.
        </p>
      </div>

      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-white p-5 shadow-sm">
        {/* Pending signatures */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <ClipboardList className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending Signatures</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-3xl font-bold text-gray-900">
                {pendingCount}
              </span>
              {pendingCount > 0 && (
                <Badge variant="warning">Action needed</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Next deadline */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
            <Clock className="h-6 w-6 text-gray-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Next timecards due</p>
            <p className="mt-0.5 font-semibold text-gray-900">
              {nextDeadline ? formatDeadline(nextDeadline) : 'No upcoming deadlines'}
            </p>
          </div>
        </div>

        {/* Batch sign CTA */}
        <Button asChild disabled={pendingCount === 0} size="lg">
          <Link href="/signee/batch">
            <ClipboardList className="mr-2 h-4 w-4" />
            To-Do
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </Link>
        </Button>
      </div>

      {/* Program Folders */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          Your Programs
        </h2>

        {(programs ?? []).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-base font-medium text-gray-700">
                No programs assigned
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                You have not been assigned as a signee for any program yet.
                Contact your administrator if this is incorrect.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(programs ?? []).map((program) => {
              const pending = pendingByProgram[program.id] ?? 0
              return (
                <Link key={program.id} href={`/signee/program/${program.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">
                          {program.name}
                        </CardTitle>
                        {pending > 0 ? (
                          <Badge variant="warning" className="shrink-0">
                            {pending} pending
                          </Badge>
                        ) : (
                          <Badge variant="success" className="shrink-0">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            All signed
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground font-mono">
                        {program.account_number}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        {pending > 0
                          ? `${pending} timecard${pending !== 1 ? 's' : ''} pending signature`
                          : 'No timecards pending signature'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
