// =============================================================================
// app/api/timecards/route.ts
// GET  – returns all timecards for the current staff user
// POST – creates a new draft timecard
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET /api/timecards
// Returns all timecards for the current user, with program and pay_period joined.
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

    const { data: timecards, error } = await supabase
      .from('timecards')
      .select(`
        *,
        programs (
          id,
          name,
          account_number
        ),
        pay_periods (
          id,
          label,
          start_date,
          end_date,
          fiscal_year
        )
      `)
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/timecards]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(timecards ?? [])
  } catch (err) {
    console.error('[GET /api/timecards] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/timecards
// Body: { program_id: string, pay_period_id: string }
// Creates a new timecard with status='draft' for the current user.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { program_id, pay_period_id } = body

    if (!program_id || !pay_period_id) {
      return NextResponse.json(
        { error: 'program_id and pay_period_id are required' },
        { status: 400 }
      )
    }

    // Verify the staff member belongs to this program
    const { data: membership } = await supabase
      .from('program_staff')
      .select('id')
      .eq('program_id', program_id)
      .eq('staff_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not assigned to this program' },
        { status: 403 }
      )
    }

    // Verify the pay period is assigned to this program
    const { data: ppp } = await supabase
      .from('program_pay_periods')
      .select('id')
      .eq('program_id', program_id)
      .eq('pay_period_id', pay_period_id)
      .single()

    if (!ppp) {
      return NextResponse.json(
        { error: 'This pay period is not assigned to the program' },
        { status: 400 }
      )
    }

    // Check for existing timecard (prevent duplicates)
    const { data: existing } = await supabase
      .from('timecards')
      .select('id, status')
      .eq('staff_id', user.id)
      .eq('program_id', program_id)
      .eq('pay_period_id', pay_period_id)
      .single()

    if (existing) {
      return NextResponse.json(existing)
    }

    // Create the timecard
    const { data: timecard, error } = await supabase
      .from('timecards')
      .insert({
        staff_id: user.id,
        program_id,
        pay_period_id,
        status: 'draft',
      })
      .select()
      .single()

    if (error || !timecard) {
      console.error('[POST /api/timecards]', error)
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create timecard' },
        { status: 500 }
      )
    }

    return NextResponse.json(timecard, { status: 201 })
  } catch (err) {
    console.error('[POST /api/timecards] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
