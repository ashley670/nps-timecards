// =============================================================================
// app/dashboard/timecard/[id]/page.tsx
// Timecard View/Edit — Server Component
// Fetches all timecard data and renders the TimecardForm in edit or view mode.
// =============================================================================

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFiscalYear } from '@/lib/utils'
import { TimecardForm } from '@/components/timecards/timecard-form'
import type { Timecard, TimecardEntry, Program, PayPeriod, User } from '@/types/app.types'

export default async function TimecardPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  // 1. Auth
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  const timecardId = params.id

  // 2. Fetch timecard
  const { data: timecard } = await supabase
    .from('timecards')
    .select('*')
    .eq('id', timecardId)
    .single()

  if (!timecard) {
    notFound()
  }

  // 3. Ownership check
  if (timecard.staff_id !== authUser.id) {
    redirect('/dashboard')
  }

  // 4. Fetch timecard entries
  const { data: entries } = await supabase
    .from('timecard_entries')
    .select('*')
    .eq('timecard_id', timecardId)
    .order('work_date', { ascending: true })

  // 5. Fetch program
  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('id', timecard.program_id)
    .single()

  if (!program) {
    redirect('/dashboard')
  }

  // 6. Fetch pay period
  const { data: payPeriod } = await supabase
    .from('pay_periods')
    .select('*')
    .eq('id', timecard.pay_period_id)
    .single()

  if (!payPeriod) {
    redirect('/dashboard')
  }

  // 7. Fetch staff user profile
  const { data: staffUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!staffUser) {
    redirect('/dashboard')
  }

  // 8. Fetch NTL rate for the fiscal year of this pay period
  const fiscalYear = getFiscalYear(new Date(payPeriod.end_date))
  const { data: ntlRateRow } = await supabase
    .from('ntl_rates')
    .select('rate')
    .eq('fiscal_year', String(fiscalYear))
    .order('set_at', { ascending: false })
    .limit(1)
    .single()

  const ntlRate: number = ntlRateRow?.rate ?? 0

  // 9. Determine edit vs view mode
  const editableStatuses = ['draft', 'reopened']
  const mode: 'edit' | 'view' = editableStatuses.includes(timecard.status) ? 'edit' : 'view'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <TimecardForm
      timecard={timecard as Timecard}
      entries={(entries ?? []) as TimecardEntry[]}
      program={program as Program}
      payPeriod={payPeriod as PayPeriod}
      staffUser={staffUser as User}
      ntlRate={ntlRate}
      mode={mode}
    />
  )
}
