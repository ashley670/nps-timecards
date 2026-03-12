// =============================================================================
// app/api/timecards/[id]/reopen/route.ts
// POST – staff requests a reopen of a submitted or signed timecard
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSigneeReopenRequest } from '@/lib/email/send'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ---------------------------------------------------------------------------
// POST /api/timecards/[id]/reopen
// Body: { reason: string }
// Validates timecard status (must be submitted or signed).
// Sets status='reopen_requested', sends email to signee.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { reason } = body

    if (!reason?.trim()) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    // Fetch timecard
    const { data: timecard } = await supabase
      .from('timecards')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!timecard) {
      return NextResponse.json({ error: 'Timecard not found' }, { status: 404 })
    }

    if (timecard.staff_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow reopen request on submitted or signed timecards
    const allowedStatuses = ['submitted', 'signed']
    if (!allowedStatuses.includes(timecard.status)) {
      return NextResponse.json(
        { error: `Cannot request reopen from status '${timecard.status}'` },
        { status: 409 }
      )
    }

    // Update timecard status
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('timecards')
      .update({
        status: 'reopen_requested',
        reopen_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError || !updated) {
      console.error('[POST /api/timecards/[id]/reopen] update', updateError)
      return NextResponse.json(
        { error: updateError?.message ?? 'Failed to update timecard' },
        { status: 500 }
      )
    }

    // Send email to signee (fire-and-forget)
    try {
      // Fetch staff name
      const { data: staffUser } = await supabaseAdmin
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // Fetch program
      const { data: program } = await supabaseAdmin
        .from('programs')
        .select('name')
        .eq('id', timecard.program_id)
        .single()

      // Fetch pay period
      const { data: payPeriod } = await supabaseAdmin
        .from('pay_periods')
        .select('label')
        .eq('id', timecard.pay_period_id)
        .single()

      // Find signee — prefer specific staff assignment, fall back to program-wide
      const { data: signeeAssignment } = await supabaseAdmin
        .from('program_signees')
        .select(`
          signee_id,
          users!program_signees_signee_id_fkey (
            email,
            full_name
          )
        `)
        .eq('program_id', timecard.program_id)
        .or(`staff_id.eq.${user.id},staff_id.is.null`)
        .limit(1)
        .single()

      const signeeUser = signeeAssignment?.users as unknown as {
        email: string
        full_name: string
      } | null

      if (signeeUser?.email && staffUser && program && payPeriod) {
        const approveUrl = `${APP_URL}/signee/timecards/${params.id}`
        sendSigneeReopenRequest(
          signeeUser.email,
          staffUser.full_name,
          program.name,
          payPeriod.label,
          reason.trim(),
          approveUrl
        ).catch((e) => console.error('[POST reopen] email error:', e))
      }
    } catch (emailErr) {
      // Email failure is non-fatal
      console.error('[POST /api/timecards/[id]/reopen] email (non-fatal)', emailErr)
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[POST /api/timecards/[id]/reopen] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
