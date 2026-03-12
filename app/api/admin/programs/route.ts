// =============================================================================
// app/api/admin/programs/route.ts
// GET  – returns all programs with staff_count and signee_count
// POST – creates a new program with staff, signees, and pay period assignments
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendStaffProgramAdded, sendSigneeProgramAdded } from '@/lib/email/send'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ---------------------------------------------------------------------------
// GET /api/admin/programs
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = createAdminClient()

    // Fetch programs with aggregate counts via sub-selects
    const { data: programs, error } = await supabase
      .from('programs')
      .select(`
        *,
        program_staff(count),
        program_signees(count)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[programs GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Flatten counts
    const result = (programs ?? []).map((p) => ({
      ...p,
      staff_count: (p.program_staff as unknown as { count: number }[])?.[0]?.count ?? 0,
      signee_count: (p.program_signees as unknown as { count: number }[])?.[0]?.count ?? 0,
      program_staff: undefined,
      program_signees: undefined,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[programs GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/programs
// Body: {
//   name: string,
//   account_number: string,
//   staff: [{ full_name, email, school }],
//   signees: [{ signee_id, staff_id? }],
//   pay_periods: [{ pay_period_id, submit_deadline }]
// }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, account_number, staff = [], signees = [], pay_periods = [] } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!account_number?.trim()) {
      return NextResponse.json({ error: 'account_number is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get admin user for created_by
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'district_admin')
      .limit(1)
      .single()

    const created_by = adminUser?.id ?? '00000000-0000-0000-0000-000000000000'

    // 1. Create program
    const { data: program, error: programError } = await supabase
      .from('programs')
      .insert({ name: name.trim(), account_number: account_number.trim(), created_by })
      .select()
      .single()

    if (programError || !program) {
      console.error('[programs POST] create program', programError)
      return NextResponse.json({ error: programError?.message ?? 'Failed to create program' }, { status: 500 })
    }

    // 2. Upsert staff users and insert program_staff rows
    const staffEmailsSent: string[] = []
    for (const member of staff as { full_name: string; email: string; school: string }[]) {
      if (!member.email?.trim() || !member.full_name?.trim()) continue

      const email = member.email.trim().toLowerCase()
      const full_name = member.full_name.trim()
      const school = member.school?.trim() ?? ''

      // Check if user exists
      let { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      let staff_id: string

      if (existingUser) {
        staff_id = existingUser.id
      } else {
        // Create auth user via admin API
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name },
        })
        if (authError || !authData.user) {
          console.error('[programs POST] create auth user', authError)
          continue
        }
        staff_id = authData.user.id

        // Insert into public.users
        const { error: userError } = await supabase
          .from('users')
          .insert({ id: staff_id, email, full_name, role: 'staff' })

        if (userError) {
          console.error('[programs POST] insert user', userError)
          continue
        }
      }

      // Insert program_staff
      const { error: psError } = await supabase
        .from('program_staff')
        .insert({ program_id: program.id, staff_id, school })

      if (psError) {
        console.error('[programs POST] insert program_staff', psError)
      }

      staffEmailsSent.push(email)
    }

    // 3. Insert program_signees
    const signeeEmailsSent: string[] = []
    for (const assignment of signees as { signee_id: string; staff_id?: string | null }[]) {
      if (!assignment.signee_id) continue

      const { error: sigError } = await supabase
        .from('program_signees')
        .insert({
          program_id: program.id,
          signee_id: assignment.signee_id,
          staff_id: assignment.staff_id ?? null,
        })

      if (sigError) {
        console.error('[programs POST] insert program_signee', sigError)
        continue
      }

      // Fetch signee email for notification
      const { data: signeeUser } = await supabase
        .from('users')
        .select('email')
        .eq('id', assignment.signee_id)
        .single()

      if (signeeUser?.email && !signeeEmailsSent.includes(signeeUser.email)) {
        signeeEmailsSent.push(signeeUser.email)
      }
    }

    // 4. Insert program_pay_periods
    for (const pp of pay_periods as { pay_period_id: string; submit_deadline: string }[]) {
      if (!pp.pay_period_id || !pp.submit_deadline) continue

      const { error: pppError } = await supabase
        .from('program_pay_periods')
        .insert({
          program_id: program.id,
          pay_period_id: pp.pay_period_id,
          submit_deadline: pp.submit_deadline,
        })

      if (pppError) {
        console.error('[programs POST] insert program_pay_period', pppError)
      }
    }

    // 5. Send welcome emails (fire-and-forget, don't fail the request)
    const loginUrl = `${APP_URL}/auth/login`
    Promise.all([
      ...staffEmailsSent.map((email) =>
        sendStaffProgramAdded(email, program.name, loginUrl).catch((e) =>
          console.error('[programs POST] staff email', e)
        )
      ),
      ...signeeEmailsSent.map((email) =>
        sendSigneeProgramAdded(email, program.name, loginUrl).catch((e) =>
          console.error('[programs POST] signee email', e)
        )
      ),
    ])

    return NextResponse.json(program, { status: 201 })
  } catch (err) {
    console.error('[programs POST] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
