// =============================================================================
// app/api/admin/programs/[id]/staff/route.ts
// GET    – returns staff members for this program
// POST   – adds a staff member to the program
// DELETE – removes a staff member from the program
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendStaffProgramAdded } from '@/lib/email/send'

type Params = { params: { id: string } }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ---------------------------------------------------------------------------
// GET /api/admin/programs/[id]/staff
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('program_staff')
      .select('*, staff:users!program_staff_staff_id_fkey(id, email, full_name, role)')
      .eq('program_id', id)
      .order('assigned_at', { ascending: true })

    if (error) {
      console.error('[programs/[id]/staff GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[programs/[id]/staff GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/programs/[id]/staff
// Body: { full_name, email, school }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const { full_name, email, school } = body

    if (!full_name?.trim()) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName = full_name.trim()
    const normalizedSchool = school?.trim() ?? ''

    // Verify program exists
    const { data: program, error: pErr } = await supabase
      .from('programs')
      .select('id, name')
      .eq('id', id)
      .single()

    if (pErr || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    let staff_id: string

    if (existingUser) {
      staff_id = existingUser.id
    } else {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { full_name: normalizedName },
      })
      if (authError || !authData.user) {
        console.error('[programs/[id]/staff POST] create auth user', authError)
        return NextResponse.json(
          { error: authError?.message ?? 'Failed to create user' },
          { status: 500 }
        )
      }
      staff_id = authData.user.id

      const { error: userError } = await supabase
        .from('users')
        .insert({ id: staff_id, email: normalizedEmail, full_name: normalizedName, role: 'staff' })

      if (userError) {
        console.error('[programs/[id]/staff POST] insert user', userError)
        return NextResponse.json({ error: userError.message }, { status: 500 })
      }
    }

    // Check if already in program
    const { data: existing } = await supabase
      .from('program_staff')
      .select('id')
      .eq('program_id', id)
      .eq('staff_id', staff_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Staff member already in this program' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('program_staff')
      .insert({ program_id: id, staff_id, school: normalizedSchool })
      .select('*, staff:users!program_staff_staff_id_fkey(id, email, full_name, role)')
      .single()

    if (error) {
      console.error('[programs/[id]/staff POST] insert program_staff', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send welcome email (fire-and-forget)
    sendStaffProgramAdded(normalizedEmail, program.name, `${APP_URL}/auth/login`).catch((e) =>
      console.error('[programs/[id]/staff POST] email', e)
    )

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[programs/[id]/staff POST] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/programs/[id]/staff
// Body: { staff_id }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const body = await req.json()
    const { staff_id } = body

    if (!staff_id) {
      return NextResponse.json({ error: 'staff_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('program_staff')
      .delete()
      .eq('program_id', id)
      .eq('staff_id', staff_id)

    if (error) {
      console.error('[programs/[id]/staff DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[programs/[id]/staff DELETE] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
