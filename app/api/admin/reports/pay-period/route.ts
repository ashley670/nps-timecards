// =============================================================================
// app/api/admin/reports/pay-period/route.ts
// POST – generates a batch PDF of all signed timecards for a pay period
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBatchPdf } from '@/lib/pdf/generate-batch'
import type { TimecardDetail } from '@/types/app.types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pay_period_id } = body

    if (!pay_period_id) {
      return NextResponse.json({ error: 'pay_period_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch the pay period
    const { data: payPeriod, error: ppErr } = await supabase
      .from('pay_periods')
      .select('*')
      .eq('id', pay_period_id)
      .single()

    if (ppErr || !payPeriod) {
      return NextResponse.json({ error: 'Pay period not found' }, { status: 404 })
    }

    // Fetch all signed timecards for this pay period with full detail
    const { data: timecards, error: tcErr } = await supabase
      .from('timecards')
      .select(`
        *,
        timecard_entries(*),
        staff:users!timecards_staff_id_fkey(id, email, full_name, address, role, created_at, updated_at),
        signee:users!timecards_signee_id_fkey(id, email, full_name, address, role, created_at, updated_at),
        program:programs(id, name, account_number, created_by, created_at, is_active)
      `)
      .eq('pay_period_id', pay_period_id)
      .eq('status', 'signed')
      .order('created_at', { ascending: true })

    if (tcErr) {
      console.error('[reports/pay-period POST]', tcErr)
      return NextResponse.json({ error: tcErr.message }, { status: 500 })
    }

    const timecardDetails: TimecardDetail[] = (timecards ?? []).map((tc) => ({
      ...tc,
      pay_period: payPeriod,
      timecard_entries: tc.timecard_entries ?? [],
    })) as TimecardDetail[]

    const label = payPeriod.label
    const pdfBuffer = await generateBatchPdf({
      title: `Timecards — ${label}`,
      subtitle: `Fiscal Year ${payPeriod.fiscal_year} • All Programs`,
      timecards: timecardDetails,
    })

    const filename = `NPS_Timecards_${label.replace(/\s+/g, '_')}_AllPrograms.pdf`

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[reports/pay-period POST] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/reports/pay-period
// Returns a preview count of signed timecards for a given pay_period_id query param
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const pay_period_id = searchParams.get('pay_period_id')

    if (!pay_period_id) {
      return NextResponse.json({ error: 'pay_period_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { count, error } = await supabase
      .from('timecards')
      .select('id', { count: 'exact', head: true })
      .eq('pay_period_id', pay_period_id)
      .eq('status', 'signed')

    if (error) {
      console.error('[reports/pay-period GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count distinct programs
    const { data: programData, error: pErr } = await supabase
      .from('timecards')
      .select('program_id')
      .eq('pay_period_id', pay_period_id)
      .eq('status', 'signed')

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    const uniquePrograms = new Set((programData ?? []).map((t) => t.program_id)).size

    return NextResponse.json({
      total_timecards: count ?? 0,
      total_programs: uniquePrograms,
    })
  } catch (err) {
    console.error('[reports/pay-period GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
