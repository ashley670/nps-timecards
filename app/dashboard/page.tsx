// =============================================================================
// app/dashboard/page.tsx
// Staff Dashboard — Server Component
// Shows fiscal year stats, action-required drafts, and program folder cards.
// =============================================================================

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getFiscalYear, getFiscalYearRange, formatCurrency, formatDate, isDeadlineSoon, isDeadlinePast } from '@/lib/utils'
import type { Program, PayPeriod, ProgramPayPeriod, Timecard, TimecardEntry } from '@/types/app.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftItem {
  timecardId: string
  programName: string
  payPeriodLabel: string
  submitDeadline: string
}

interface ProgramCard {
  programId: string
  programName: string
  accountNumber: string
  hoursThisYear: number
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Get current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // 2. Fetch full user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/auth/login')
  }

  // 3. Fiscal year context
  const fiscalYear = getFiscalYear()
  const fiscalYearStr = String(fiscalYear)
  const { start: fyStart, end: fyEnd } = getFiscalYearRange(fiscalYear)
  const fyStartISO = fyStart.toISOString().split('T')[0]
  const fyEndISO = fyEnd.toISOString().split('T')[0]

  // 4. Fetch programs for this staff member via program_staff
  const { data: programStaffRows } = await supabase
    .from('program_staff')
    .select(`
      program_id,
      programs (
        id,
        name,
        account_number,
        is_active
      )
    `)
    .eq('staff_id', user.id)

  const programs: Program[] = (programStaffRows ?? [])
    .map((row) => row.programs as unknown as Program)
    .filter(Boolean)
    .filter((p) => p.is_active)

  const programIds = programs.map((p) => p.id)

  // 5. Fetch NTL rate for current fiscal year
  const { data: ntlRateRow } = await supabase
    .from('ntl_rates')
    .select('rate')
    .eq('fiscal_year', fiscalYearStr)
    .order('set_at', { ascending: false })
    .limit(1)
    .single()

  const ntlRate: number = ntlRateRow?.rate ?? 0

  // 6. Fetch all timecards for this user with their entries (for hour calculation)
  //    We only care about non-draft timecards for the total hours stat.
  let totalHoursThisYear = 0
  const programHoursMap: Record<string, number> = {}

  if (programIds.length > 0) {
    // Fetch pay periods in this fiscal year
    const { data: payPeriodsInFY } = await supabase
      .from('pay_periods')
      .select('id')
      .eq('fiscal_year', fiscalYearStr)

    const fyPayPeriodIds = (payPeriodsInFY ?? []).map((pp) => pp.id)

    if (fyPayPeriodIds.length > 0) {
      // Fetch submitted/signed timecards in the FY pay periods
      const { data: submittedTimecards } = await supabase
        .from('timecards')
        .select(`
          id,
          program_id,
          status,
          timecard_entries (
            total_hours
          )
        `)
        .eq('staff_id', user.id)
        .in('program_id', programIds)
        .in('pay_period_id', fyPayPeriodIds)
        .neq('status', 'draft')

      for (const tc of submittedTimecards ?? []) {
        const entries = (tc.timecard_entries as unknown as Pick<TimecardEntry, 'total_hours'>[]) ?? []
        const tcHours = entries.reduce((sum, e) => sum + (e.total_hours ?? 0), 0)
        totalHoursThisYear += tcHours
        if (tc.program_id) {
          programHoursMap[tc.program_id] = (programHoursMap[tc.program_id] ?? 0) + tcHours
        }
      }
    }
  }

  // 7. Fetch draft timecards that have at least one entry (action required)
  const draftItems: DraftItem[] = []

  if (programIds.length > 0) {
    const { data: draftTimecards } = await supabase
      .from('timecards')
      .select(`
        id,
        program_id,
        pay_period_id,
        status,
        timecard_entries (
          id
        )
      `)
      .eq('staff_id', user.id)
      .eq('status', 'draft')
      .in('program_id', programIds)

    // Filter to those with at least one entry
    const draftsWithEntries = (draftTimecards ?? []).filter(
      (tc) => ((tc.timecard_entries as unknown as { id: string }[]) ?? []).length > 0
    )

    if (draftsWithEntries.length > 0) {
      // Gather pay period IDs and program IDs
      const draftPayPeriodIds = Array.from(new Set(draftsWithEntries.map((tc) => tc.pay_period_id)))
      const draftProgramIds = Array.from(new Set(draftsWithEntries.map((tc) => tc.program_id)))

      // Fetch pay periods
      const { data: payPeriodsData } = await supabase
        .from('pay_periods')
        .select('id, label')
        .in('id', draftPayPeriodIds)

      const payPeriodMap = Object.fromEntries((payPeriodsData ?? []).map((pp) => [pp.id, pp]))

      // Fetch program_pay_periods for deadlines
      const { data: pppData } = await supabase
        .from('program_pay_periods')
        .select('program_id, pay_period_id, submit_deadline')
        .in('program_id', draftProgramIds)
        .in('pay_period_id', draftPayPeriodIds)

      const pppMap = Object.fromEntries(
        (pppData ?? []).map((ppp) => [`${ppp.program_id}__${ppp.pay_period_id}`, ppp])
      )

      const programMap = Object.fromEntries(programs.map((p) => [p.id, p]))

      for (const tc of draftsWithEntries) {
        const program = programMap[tc.program_id]
        const pp = payPeriodMap[tc.pay_period_id]
        const ppp = pppMap[`${tc.program_id}__${tc.pay_period_id}`]
        if (!program || !pp) continue

        draftItems.push({
          timecardId: tc.id,
          programName: program.name,
          payPeriodLabel: pp.label,
          submitDeadline: ppp?.submit_deadline ?? '',
        })
      }
    }
  }

  // 8. Build program cards
  const programCards: ProgramCard[] = programs.map((p) => ({
    programId: p.id,
    programName: p.name,
    accountNumber: p.account_number,
    hoursThisYear: programHoursMap[p.id] ?? 0,
  }))

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* TOP BANNER — fiscal year stats                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-700 uppercase tracking-wide">
                This Fiscal Year
              </p>
              <p className="text-2xl font-bold text-blue-900">
                {totalHoursThisYear.toFixed(2)} hrs
              </p>
              <p className="text-sm text-blue-600">Total Hours Worked This Year</p>
            </div>
            <div className="space-y-1 sm:text-right">
              <p className="text-sm font-medium text-blue-700 uppercase tracking-wide">
                Current NTL Rate
              </p>
              <p className="text-2xl font-bold text-blue-900">
                {ntlRate > 0 ? `${formatCurrency(ntlRate)} / hr` : 'Not set'}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm italic text-blue-600">
            Always check your paycheck to ensure you are paid correctly.
          </p>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* ACTION REQUIRED — draft timecards with entries                       */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Action Required</h2>
        {draftItems.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-gray-500">
              No timecards require action right now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {draftItems.map((item) => {
              const pastDue = item.submitDeadline ? isDeadlinePast(item.submitDeadline) : false
              const soon = item.submitDeadline ? isDeadlineSoon(item.submitDeadline) : false
              const deadlineUrgent = pastDue || soon

              return (
                <Link
                  key={item.timecardId}
                  href={`/dashboard/timecard/${item.timecardId}`}
                  className="block"
                >
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="space-y-0.5">
                        <p className="font-medium text-gray-900">{item.programName}</p>
                        <p className="text-sm text-gray-500">{item.payPeriodLabel}</p>
                        {item.submitDeadline && (
                          <p
                            className={`text-xs ${
                              deadlineUrgent ? 'font-semibold text-red-600' : 'text-gray-400'
                            }`}
                          >
                            Due: {formatDate(item.submitDeadline)}
                            {pastDue && ' — OVERDUE'}
                            {!pastDue && soon && ' — Due soon'}
                          </p>
                        )}
                      </div>
                      <Badge variant="warning">Draft</Badge>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* MY PROGRAMS — folder cards                                           */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">My Programs</h2>
        {programCards.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-gray-500">
              You have not been assigned to any programs yet. Contact your administrator.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {programCards.map((card) => (
              <Link key={card.programId} href={`/dashboard/program/${card.programId}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{card.programName}</CardTitle>
                    <p className="text-xs text-gray-500">{card.accountNumber}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">{card.hoursThisYear.toFixed(2)}</span> hrs
                      this year
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
