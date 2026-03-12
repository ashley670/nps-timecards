// =============================================================================
// app/api/admin/pay-periods/route.ts
// GET – returns all pay periods ordered by start_date desc
// =============================================================================

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('pay_periods')
      .select('*, program_pay_periods(count)')
      .order('start_date', { ascending: false })

    if (error) {
      console.error('[pay-periods GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[pay-periods GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
