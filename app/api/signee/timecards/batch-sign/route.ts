// =============================================================================
// app/api/signee/timecards/batch-sign/route.ts
// POST — batch sign multiple timecards
// Body: { timecardIds: string[], signature: string }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendStaffTimecardSigned } from '@/lib/email/send'

export async function POST(req: NextRequest) {
  try {
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
    const { timecardIds, signature } = body as {
      timecardIds?: string[]
      signature?: string
    }

    if (!Array.isArray(timecardIds) || timecardIds.length === 0) {
      return NextResponse.json(
        { error: 'timecardIds must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!signature?.trim()) {
      return NextResponse.json(
        { error: 'signature is required' },
        { status: 400 }
      )
    }

    const trimmedSignature = signature.trim()

    // 1. Fetch all targeted timecards
    const { data: timecards, error: tcError } = await supabase
      .from('timecards')
      .select(`
        id, program_id, staff_id, status,
        programs!inner(name),
        pay_periods!inner(label),
        users!timecards_staff_id_fkey(full_name, email)
      `)
      .in('id', timecardIds)

    if (tcError) {
      console.error('[POST /api/signee/timecards/batch-sign] fetch', tcError)
      return NextResponse.json({ error: tcError.message }, { status: 500 })
    }

    if (!timecards || timecards.length === 0) {
      return NextResponse.json({ error: 'No timecards found' }, { status: 404 })
    }

    type TimecardRow = {
      id: string
      program_id: string
      staff_id: string
      status: string
      programs: { name: string }
      pay_periods: { label: string }
      users: { full_name: string; email: string }
    }
    const tcs = timecards as unknown as TimecardRow[]

    // 2. Fetch signee's program assignments for access validation
    const programIds = Array.from(new Set(tcs.map((tc) => tc.program_id)))

    const { data: signeeRows, error: signeeError } = await supabase
      .from('program_signees')
      .select('program_id, staff_id')
      .eq('signee_id', user.id)
      .in('program_id', programIds)

    if (signeeError) {
      console.error('[POST /api/signee/timecards/batch-sign] signee rows', signeeError)
      return NextResponse.json({ error: signeeError.message }, { status: 500 })
    }

    // 3. Validate ALL timecards before touching any
    const accessErrors: string[] = []
    const statusErrors: string[] = []

    for (const tc of tcs) {
      // Check access
      const hasAccess = (signeeRows ?? []).some(
        (r) =>
          r.program_id === tc.program_id &&
          (r.staff_id === null || r.staff_id === tc.staff_id)
      )
      if (!hasAccess) {
        accessErrors.push(tc.id)
        continue
      }

      // Check status
      if (tc.status !== 'submitted') {
        statusErrors.push(`${tc.id} (status: ${tc.status})`)
      }
    }

    if (accessErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Access denied for one or more timecards',
          timecardIds: accessErrors,
        },
        { status: 403 }
      )
    }

    if (statusErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more timecards are not in submitted status',
          details: statusErrors,
        },
        { status: 422 }
      )
    }

    // 4. Batch update all timecards
    const now = new Date().toISOString()
    const validIds = tcs.map((tc) => tc.id)

    const { error: updateError } = await supabase
      .from('timecards')
      .update({
        status: 'signed',
        signee_id: user.id,
        signee_signature: trimmedSignature,
        signee_signed_at: now,
        updated_at: now,
      })
      .in('id', validIds)

    if (updateError) {
      console.error('[POST /api/signee/timecards/batch-sign] update', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 5. Fetch signee name for emails
    const { data: signeeUser } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const signeeName = signeeUser?.full_name ?? 'Your signee'

    // 6. Send emails to each staff member (fire-and-forget)
    const emailPromises = tcs.map((tc) => {
      const staffEmail = tc.users?.email
      if (!staffEmail) return Promise.resolve()
      return sendStaffTimecardSigned(
        staffEmail,
        tc.programs?.name ?? '',
        tc.pay_periods?.label ?? '',
        signeeName
      ).catch((e) =>
        console.error(`[batch-sign] email error for ${tc.id}`, e)
      )
    })

    Promise.all(emailPromises).catch((e) =>
      console.error('[batch-sign] email batch error', e)
    )

    return NextResponse.json({
      signed: validIds.length,
      timecardIds: validIds,
      errors: [],
    })
  } catch (err) {
    console.error('[POST /api/signee/timecards/batch-sign] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
