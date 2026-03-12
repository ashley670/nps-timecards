// =============================================================================
// app/api/admin/programs/[id]/route.ts
// GET    – program detail with staff, signees, pay_periods, timecard summary
// PATCH  – update name / account_number / is_active
// DELETE – soft-delete (set is_active = false)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: { id: string } }

// ---------------------------------------------------------------------------
// GET /api/admin/programs/[id]
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const supabase = createAdminClient()

    // Fetch program
    const { data: program, error: pErr } = await supabase
      .from('programs')
      .select('*')
      .eq('id', id)
      .single()

    if (pErr || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Staff with user details
    const { data: staff } = await supabase
      .from('program_staff')
      .select('*, staff:users!program_staff_staff_id_fkey(id, email, full_name, role)')
      .eq('program_id', id)
      .order('assigned_at', { ascending: true })

    // Signees with user details
    const { data: signees } = await supabase
      .from('program_signees')
      .select('*, signee:users!program_signees_signee_id_fkey(id, email, full_name, role)')
      .eq('program_id', id)
      .order('assigned_at', { ascending: true })

    // Pay periods with pay_period details
    const { data: payPeriods } = await supabase
      .from('program_pay_periods')
      .select('*, pay_period:pay_periods(*)')
      .eq('program_id', id)
      .order('submit_deadline', { ascending: true })

    // Timecard summary: each staff + pay period combination and status
    const { data: timecards } = await supabase
      .from('timecards')
      .select(`
        id,
        status,
        staff_id,
        pay_period_id,
        submitted_at,
        signee_signed_at,
        staff:users!timecards_staff_id_fkey(full_name, email),
        pay_period:pay_periods(label, start_date, end_date)
      `)
      .eq('program_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      ...program,
      staff: staff ?? [],
      signees: signees ?? [],
      pay_periods: payPeriods ?? [],
      timecards: timecards ?? [],
    })
  } catch (err) {
    console.error('[programs/[id] GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/programs/[id]
// Body: { name?, account_number?, is_active? }
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const { name, account_number, is_active } = body

    const updates: Record<string, unknown> = {}
    if (typeof name === 'string' && name.trim()) updates.name = name.trim()
    if (typeof account_number === 'string' && account_number.trim()) {
      updates.account_number = account_number.trim()
    }
    if (typeof is_active === 'boolean') updates.is_active = is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('programs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[programs/[id] PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[programs/[id] PATCH] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/programs/[id]
// Soft-delete: sets is_active = false
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('programs')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[programs/[id] DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[programs/[id] DELETE] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
