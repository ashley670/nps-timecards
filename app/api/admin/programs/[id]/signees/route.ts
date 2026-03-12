// =============================================================================
// app/api/admin/programs/[id]/signees/route.ts
// GET    – returns signee assignments for this program
// POST   – adds signee assignments
// DELETE – removes a signee assignment
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSigneeProgramAdded } from '@/lib/email/send'

type Params = { params: { id: string } }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ---------------------------------------------------------------------------
// GET /api/admin/programs/[id]/signees
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('program_signees')
      .select('*, signee:users!program_signees_signee_id_fkey(id, email, full_name, role)')
      .eq('program_id', id)
      .order('assigned_at', { ascending: true })

    if (error) {
      console.error('[programs/[id]/signees GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[programs/[id]/signees GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/programs/[id]/signees
// Body: { assignments: [{ signee_id, staff_id? }] }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const { assignments } = body

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ error: 'assignments array is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify program exists
    const { data: program, error: pErr } = await supabase
      .from('programs')
      .select('id, name')
      .eq('id', id)
      .single()

    if (pErr || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    const inserted = []
    const signeeEmailsSent = new Set<string>()

    for (const assignment of assignments as { signee_id: string; staff_id?: string | null }[]) {
      if (!assignment.signee_id) continue

      const { data, error } = await supabase
        .from('program_signees')
        .insert({
          program_id: id,
          signee_id: assignment.signee_id,
          staff_id: assignment.staff_id ?? null,
        })
        .select('*, signee:users!program_signees_signee_id_fkey(id, email, full_name, role)')
        .single()

      if (error) {
        console.error('[programs/[id]/signees POST] insert', error)
        continue
      }

      inserted.push(data)

      // Collect signee email for notification
      const signeeUser = data?.signee as { email?: string } | null
      if (signeeUser?.email && !signeeEmailsSent.has(signeeUser.email)) {
        signeeEmailsSent.add(signeeUser.email)
      }
    }

    // Send emails (fire-and-forget)
    const loginUrl = `${APP_URL}/auth/login`
    signeeEmailsSent.forEach((email) => {
      sendSigneeProgramAdded(email, program.name, loginUrl).catch((e) =>
        console.error('[programs/[id]/signees POST] email', e)
      )
    })

    return NextResponse.json(inserted, { status: 201 })
  } catch (err) {
    console.error('[programs/[id]/signees POST] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/programs/[id]/signees
// Body: { signee_id, staff_id? }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const { signee_id, staff_id } = body

    if (!signee_id) {
      return NextResponse.json({ error: 'signee_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from('program_signees')
      .delete()
      .eq('program_id', id)
      .eq('signee_id', signee_id)

    // If staff_id provided, delete only that specific assignment
    if (staff_id) {
      query = query.eq('staff_id', staff_id)
    } else {
      query = query.is('staff_id', null)
    }

    const { error } = await query

    if (error) {
      console.error('[programs/[id]/signees DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[programs/[id]/signees DELETE] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
