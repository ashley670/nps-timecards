// =============================================================================
// app/api/signee/timecards/route.ts
// GET — returns submitted timecards assigned to this signee
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch signee's program assignments
    const { data: signeeRows, error: signeeError } = await supabase
      .from('program_signees')
      .select('program_id, staff_id')
      .eq('signee_id', user.id)

    if (signeeError) {
      console.error('[GET /api/signee/timecards] signee rows', signeeError)
      return NextResponse.json({ error: signeeError.message }, { status: 500 })
    }

    const programIds = Array.from(
      new Set((signeeRows ?? []).map((r) => r.program_id))
    )

    if (!programIds.length) {
      return NextResponse.json([])
    }

    // 2. Fetch submitted timecards for those programs with related data
    const { data: timecards, error: tcError } = await supabase
      .from('timecards')
      .select(`
        id, program_id, pay_period_id, staff_id, status, submitted_at,
        signee_signature, signee_signed_at,
        programs!inner(id, name, account_number),
        pay_periods!inner(id, label, start_date, end_date),
        users!timecards_staff_id_fkey(id, full_name, email)
      `)
      .in('program_id', programIds)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })

    if (tcError) {
      console.error('[GET /api/signee/timecards] timecards', tcError)
      return NextResponse.json({ error: tcError.message }, { status: 500 })
    }

    // 3. Filter by access rule
    const filtered = (timecards ?? []).filter((tc) =>
      (signeeRows ?? []).some(
        (r) =>
          r.program_id === tc.program_id &&
          (r.staff_id === null || r.staff_id === tc.staff_id)
      )
    )

    return NextResponse.json(filtered)
  } catch (err) {
    console.error('[GET /api/signee/timecards] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
