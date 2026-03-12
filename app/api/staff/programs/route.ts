// =============================================================================
// app/api/staff/programs/route.ts
// GET – returns programs for the current staff user with timecard stats
//        (hours per program this fiscal year)
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFiscalYear } from '@/lib/utils'

// ---------------------------------------------------------------------------
// GET /api/staff/programs
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch programs for this staff member
    const { data: programStaffRows, error: psError } = await supabase
      .from('program_staff')
      .select(`
        id,
        school,
        program_id,
        programs (
          id,
          name,
          account_number,
          is_active,
          created_at
        )
      `)
      .eq('staff_id', user.id)

    if (psError) {
      console.error('[GET /api/staff/programs] program_staff', psError)
      return NextResponse.json({ error: psError.message }, { status: 500 })
    }

    const programs = (programStaffRows ?? [])
      .map((row) => ({
        ...(row.programs as unknown as {
          id: string
          name: string
          account_number: string
          is_active: boolean
          created_at: string
        }),
        school: row.school,
      }))
      .filter((p) => p.is_active)

    if (programs.length === 0) {
      return NextResponse.json([])
    }

    const programIds = programs.map((p) => p.id)

    // 2. Determine current fiscal year
    const fiscalYear = getFiscalYear()
    const fiscalYearStr = String(fiscalYear)

    // 3. Fetch pay periods for this fiscal year
    const { data: payPeriods } = await supabase
      .from('pay_periods')
      .select('id')
      .eq('fiscal_year', fiscalYearStr)

    const fyPayPeriodIds = (payPeriods ?? []).map((pp) => pp.id)

    // 4. Fetch timecards + hours per program this fiscal year (non-draft)
    const programHoursMap: Record<string, number> = {}

    if (fyPayPeriodIds.length > 0) {
      const { data: timecards } = await supabase
        .from('timecards')
        .select(`
          program_id,
          timecard_entries (
            total_hours
          )
        `)
        .eq('staff_id', user.id)
        .in('program_id', programIds)
        .in('pay_period_id', fyPayPeriodIds)
        .neq('status', 'draft')

      for (const tc of timecards ?? []) {
        const hours = (
          tc.timecard_entries as unknown as Array<{ total_hours: number }>
        ).reduce((sum, e) => sum + (e.total_hours ?? 0), 0)

        if (tc.program_id) {
          programHoursMap[tc.program_id] = (programHoursMap[tc.program_id] ?? 0) + hours
        }
      }
    }

    // 5. Fetch timecard counts per program (any status)
    const timecardCountMap: Record<string, number> = {}
    const { data: allTimecards } = await supabase
      .from('timecards')
      .select('program_id, status')
      .eq('staff_id', user.id)
      .in('program_id', programIds)

    for (const tc of allTimecards ?? []) {
      timecardCountMap[tc.program_id] = (timecardCountMap[tc.program_id] ?? 0) + 1
    }

    // 6. Build response
    const result = programs.map((p) => ({
      id: p.id,
      name: p.name,
      account_number: p.account_number,
      school: p.school,
      created_at: p.created_at,
      hours_this_year: programHoursMap[p.id] ?? 0,
      timecard_count: timecardCountMap[p.id] ?? 0,
      fiscal_year: fiscalYearStr,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/staff/programs] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
