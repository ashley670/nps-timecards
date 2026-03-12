// =============================================================================
// app/signee/batch/page.tsx
// Batch Signing Page — Server Component
// Fetches all submitted timecards for this signee and renders the batch UI.
// =============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BatchSigningClient } from '@/components/timecards/batch-signing-client'
import type { BatchTimecard } from '@/components/timecards/batch-signing-client'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BatchSigningPage() {
  const supabase = await createClient()

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // 1. Get signee's full name for pre-filling the signature
  const { data: signeeProfile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const signeeName = signeeProfile?.full_name ?? ''

  // 2. Fetch all program_signees rows for this user
  const { data: signeeRows } = await supabase
    .from('program_signees')
    .select('program_id, staff_id')
    .eq('signee_id', user.id)

  const programIds = Array.from(
    new Set((signeeRows ?? []).map((r) => r.program_id))
  )

  if (!programIds.length) {
    return (
      <div className="space-y-6">
        <BackLink />
        <AllCaughtUp />
      </div>
    )
  }

  // 3. Fetch submitted timecards with all related data
  const { data: rawTimecards } = await supabase
    .from('timecards')
    .select(`
      id, program_id, staff_id, status, submitted_at,
      programs!inner(id, name),
      pay_periods!inner(id, label, start_date, end_date),
      users!timecards_staff_id_fkey(id, full_name),
      timecard_entries(id, work_date, time_in, time_out, total_hours)
    `)
    .in('program_id', programIds)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true })

  type RawTimecard = {
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

  const allTimecards = (rawTimecards ?? []) as unknown as RawTimecard[]

  // 4. Filter by access rule: staff_id IS NULL covers all staff, or specific staff_id
  function signeeCanSee(tc: { program_id: string; staff_id: string }): boolean {
    return (signeeRows ?? []).some(
      (r) =>
        r.program_id === tc.program_id &&
        (r.staff_id === null || r.staff_id === tc.staff_id)
    )
  }

  const visibleTimecards = allTimecards.filter(signeeCanSee) as BatchTimecard[]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <BackLink />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Batch Signing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign multiple timecards at once. Select the timecards you want to sign
          and enter your full name.
        </p>
      </div>

      {visibleTimecards.length === 0 ? (
        <AllCaughtUp />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {visibleTimecards.length} timecard
              {visibleTimecards.length !== 1 ? 's' : ''} awaiting your signature
            </span>
          </div>
          <BatchSigningClient
            timecards={visibleTimecards}
            signeeName={signeeName}
          />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/signee"
      className="inline-flex items-center text-sm text-muted-foreground hover:text-gray-900"
    >
      <ArrowLeft className="mr-1 h-4 w-4" />
      Back to Dashboard
    </Link>
  )
}

function AllCaughtUp() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 mb-5">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <p className="text-lg font-semibold text-gray-800">All caught up!</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          There are no timecards waiting for your signature right now.
          Check back after staff submit their next timecards.
        </p>
      </CardContent>
    </Card>
  )
}
