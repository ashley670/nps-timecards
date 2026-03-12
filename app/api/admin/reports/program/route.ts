// =============================================================================
// app/api/admin/reports/program/route.ts
// POST – generates a batch PDF of signed timecards for a program
//        (optionally filtered by pay period)
// GET  – returns preview count
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBatchPdf } from '@/lib/pdf/generate-batch'
import type { TimecardDetail } from '@/types/app.types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { program_id, pay_period_id } = body

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch the program
    const { data: program, error: progErr } = await supabase
      .from('programs')
      .select('*')
      .eq('id', program_id)
      .single()

    if (progErr || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Build timecard query
    let tcQuery = supabase
      .from('timecards')
      .select(`
        *,
        timecard_entries(*),
        staff:users!timecards_staff_id_fkey(id, email, full_name, address, role, created_at, updated_at),
        signee:users!timecards_signee_id_fkey(id, email, full_name, address, role, created_at, updated_at),
        pay_period:pay_periods(id, label, start_date, end_date, fiscal_year, created_by)
      `)
      .eq('program_id', program_id)
      .eq('status', 'signed')
      .order('created_at', { ascending: true })

    if (pay_period_id && pay_period_id !== 'all') {
      tcQuery = tcQuery.eq('pay_period_id', pay_period_id)
    }

    const { data: timecards, error: tcErr } = await tcQuery

    if (tcErr) {
      console.error('[reports/program POST]', tcErr)
      return NextResponse.json({ error: tcErr.message }, { status: 500 })
    }

    const timecardDetails: TimecardDetail[] = (timecards ?? []).map((tc) => ({
      ...tc,
      program,
      timecard_entries: tc.timecard_entries ?? [],
    })) as TimecardDetail[]

    const payPeriodLabel =
      pay_period_id && pay_period_id !== 'all' ? '_ByPayPeriod' : '_AllPayPeriods'

    const pdfBuffer = await generateBatchPdf({
      title: `Timecards — ${program.name}`,
      subtitle: `Account: ${program.account_number}${pay_period_id && pay_period_id !== 'all' ? '' : ' • All Pay Periods'}`,
      timecards: timecardDetails,
    })

    const filename = `NPS_Timecards_${program.name.replace(/\s+/g, '_')}${payPeriodLabel}.pdf`

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[reports/program POST] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const program_id = searchParams.get('program_id')
    const pay_period_id = searchParams.get('pay_period_id')

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from('timecards')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', program_id)
      .eq('status', 'signed')

    if (pay_period_id && pay_period_id !== 'all') {
      query = query.eq('pay_period_id', pay_period_id)
    }

    const { count, error } = await query

    if (error) {
      console.error('[reports/program GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ total_timecards: count ?? 0 })
  } catch (err) {
    console.error('[reports/program GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
