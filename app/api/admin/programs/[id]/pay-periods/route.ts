// =============================================================================
// app/api/admin/programs/[id]/pay-periods/route.ts
// GET    – returns pay periods assigned to this program
// POST   – assigns a pay period to this program
// DELETE – unassigns a pay period from this program
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: { id: string } }

// ---------------------------------------------------------------------------
// GET /api/admin/programs/[id]/pay-periods
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('program_pay_periods')
      .select('*, pay_period:pay_periods(*)')
      .eq('program_id', id)
      .order('submit_deadline', { ascending: true })

    if (error) {
      console.error('[programs/[id]/pay-periods GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[programs/[id]/pay-periods GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/programs/[id]/pay-periods
// Body: { pay_period_id, submit_deadline }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const { pay_period_id, submit_deadline } = body

    if (!pay_period_id) {
      return NextResponse.json({ error: 'pay_period_id is required' }, { status: 400 })
    }
    if (!submit_deadline) {
      return NextResponse.json({ error: 'submit_deadline is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check if already assigned
    const { data: existing } = await supabase
      .from('program_pay_periods')
      .select('id')
      .eq('program_id', id)
      .eq('pay_period_id', pay_period_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Pay period already assigned to this program' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('program_pay_periods')
      .insert({ program_id: id, pay_period_id, submit_deadline })
      .select('*, pay_period:pay_periods(*)')
      .single()

    if (error) {
      console.error('[programs/[id]/pay-periods POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[programs/[id]/pay-periods POST] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/programs/[id]/pay-periods
// Body: { pay_period_id }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const { pay_period_id } = body

    if (!pay_period_id) {
      return NextResponse.json({ error: 'pay_period_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('program_pay_periods')
      .delete()
      .eq('program_id', id)
      .eq('pay_period_id', pay_period_id)

    if (error) {
      console.error('[programs/[id]/pay-periods DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[programs/[id]/pay-periods DELETE] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
