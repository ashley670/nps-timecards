// =============================================================================
// app/api/admin/reports/staff/route.ts
// POST – generates a batch PDF of signed timecards for a staff member
// GET  – returns preview count
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateBatchPdf } from '@/lib/pdf/generate-batch'
import type { TimecardDetail } from '@/types/app.types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { staff_id, program_id, pay_period_id } = body

    if (!staff_id) {
      return NextResponse.json({ error: 'staff_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch staff user
    const { data: staffUser, error: staffErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', staff_id)
      .single()

    if (staffErr || !staffUser) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    // Build timecard query
    let tcQuery = supabase
      .from('timecards')
      .select(`
        *,
        timecard_entries(*),
        signee:users!timecards_signee_id_fkey(id, email, full_name, address, role, created_at, updated_at),
        program:programs(id, name, account_number, created_by, created_at, is_active),
        pay_period:pay_periods(id, label, start_date, end_date, fiscal_year, created_by)
      `)
      .eq('staff_id', staff_id)
      .eq('status', 'signed')
      .order('created_at', { ascending: true })

    if (program_id) {
      tcQuery = tcQuery.eq('program_id', program_id)
    }
    if (pay_period_id) {
      tcQuery = tcQuery.eq('pay_period_id', pay_period_id)
    }

    const { data: timecards, error: tcErr } = await tcQuery

    if (tcErr) {
      console.error('[reports/staff POST]', tcErr)
      return NextResponse.json({ error: tcErr.message }, { status: 500 })
    }

    const timecardDetails: TimecardDetail[] = (timecards ?? []).map((tc) => ({
      ...tc,
      staff: staffUser,
      timecard_entries: tc.timecard_entries ?? [],
    })) as TimecardDetail[]

    const pdfBuffer = await generateBatchPdf({
      title: `Timecards — ${staffUser.full_name}`,
      subtitle: `Staff Member Report`,
      timecards: timecardDetails,
    })

    const filename = `NPS_Timecards_${staffUser.full_name.replace(/\s+/g, '_')}.pdf`

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[reports/staff POST] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const staff_id = searchParams.get('staff_id')
    const program_id = searchParams.get('program_id')
    const pay_period_id = searchParams.get('pay_period_id')

    if (!staff_id) {
      return NextResponse.json({ error: 'staff_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from('timecards')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staff_id)
      .eq('status', 'signed')

    if (program_id) {
      query = query.eq('program_id', program_id)
    }
    if (pay_period_id) {
      query = query.eq('pay_period_id', pay_period_id)
    }

    const { count, error } = await query

    if (error) {
      console.error('[reports/staff GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ total_timecards: count ?? 0 })
  } catch (err) {
    console.error('[reports/staff GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
