// =============================================================================
// app/api/signee/timecards/[id]/sign/route.ts
// POST — sign a timecard
// Body: { signature: string }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendStaffTimecardSigned } from '@/lib/email/send'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: timecardId } = await params
    const supabase = await createClient()

    // Auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    const body = await req.json().catch(() => ({}))
    const { signature } = body as { signature?: string }

    if (!signature?.trim()) {
      return NextResponse.json(
        { error: 'signature is required' },
        { status: 400 }
      )
    }

    // 1. Fetch the timecard
    const { data: timecard, error: tcError } = await supabase
      .from('timecards')
      .select('id, program_id, staff_id, status')
      .eq('id', timecardId)
      .single()

    if (tcError || !timecard) {
      return NextResponse.json({ error: 'Timecard not found' }, { status: 404 })
    }

    // 2. Validate signee access
    const { data: signeeRow } = await supabase
      .from('program_signees')
      .select('id')
      .eq('signee_id', user.id)
      .eq('program_id', timecard.program_id)
      .or(`staff_id.is.null,staff_id.eq.${timecard.staff_id}`)
      .limit(1)
      .single()

    if (!signeeRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Validate status
    if (timecard.status !== 'submitted') {
      return NextResponse.json(
        { error: `Timecard cannot be signed in status: ${timecard.status}` },
        { status: 422 }
      )
    }

    // 4. Update the timecard
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('timecards')
      .update({
        status: 'signed',
        signee_id: user.id,
        signee_signature: signature.trim(),
        signee_signed_at: now,
        updated_at: now,
      })
      .eq('id', timecardId)
      .select(`
        id, status, signee_id, signee_signature, signee_signed_at, updated_at,
        programs!inner(name),
        pay_periods!inner(label),
        users!timecards_staff_id_fkey(full_name, email)
      `)
      .single()

    if (updateError || !updated) {
      console.error('[POST /api/signee/timecards/[id]/sign] update', updateError)
      return NextResponse.json(
        { error: updateError?.message ?? 'Failed to update timecard' },
        { status: 500 }
      )
    }

    // 5. Fetch signee name for email
    const { data: signeeUser } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // 6. Send email to staff (fire-and-forget)
    type UpdatedRow = typeof updated & {
      programs: { name: string }
      pay_periods: { label: string }
      users: { full_name: string; email: string }
    }
    const upd = updated as unknown as UpdatedRow

    const staffEmail = upd.users?.email
    const programName = upd.programs?.name ?? ''
    const payPeriodLabel = upd.pay_periods?.label ?? ''
    const signeeName = signeeUser?.full_name ?? 'Your signee'

    if (staffEmail) {
      sendStaffTimecardSigned(
        staffEmail,
        programName,
        payPeriodLabel,
        signeeName
      ).catch((e) => console.error('[sign route] email error', e))
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[POST /api/signee/timecards/[id]/sign] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
