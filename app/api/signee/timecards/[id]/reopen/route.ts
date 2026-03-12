// =============================================================================
// app/api/signee/timecards/[id]/reopen/route.ts
// POST — approve or deny a reopen request
// Body: { approved: boolean }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sendStaffReopenApproved,
  sendStaffReopenDenied,
} from '@/lib/email/send'

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
    const { approved } = body as { approved?: boolean }

    if (typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'approved (boolean) is required' },
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
    if (timecard.status !== 'reopen_requested') {
      return NextResponse.json(
        {
          error: `Timecard is not in reopen_requested status (current: ${timecard.status})`,
        },
        { status: 422 }
      )
    }

    // 4. Determine new status and update fields
    const now = new Date().toISOString()

    const updatePayload = approved
      ? {
          status: 'reopened' as const,
          reopen_approved_by: user.id,
          reopen_approved_at: now,
          updated_at: now,
        }
      : {
          // Deny: revert to submitted — timecard stays locked, staff can resubmit
          status: 'submitted' as const,
          reopen_reason: null,
          updated_at: now,
        }

    const { data: updated, error: updateError } = await supabase
      .from('timecards')
      .update(updatePayload)
      .eq('id', timecardId)
      .select(`
        id, status, reopen_approved_by, reopen_approved_at, updated_at,
        programs!inner(name),
        pay_periods!inner(label),
        users!timecards_staff_id_fkey(full_name, email)
      `)
      .single()

    if (updateError || !updated) {
      console.error('[POST /api/signee/timecards/[id]/reopen] update', updateError)
      return NextResponse.json(
        { error: updateError?.message ?? 'Failed to update timecard' },
        { status: 500 }
      )
    }

    // 5. Send email to staff (fire-and-forget)
    type UpdatedRow = typeof updated & {
      programs: { name: string }
      pay_periods: { label: string }
      users: { full_name: string; email: string }
    }
    const upd = updated as unknown as UpdatedRow

    const staffEmail = upd.users?.email
    const programName = upd.programs?.name ?? ''
    const payPeriodLabel = upd.pay_periods?.label ?? ''
    const loginUrl = `${APP_URL}/auth/login`

    if (staffEmail) {
      if (approved) {
        sendStaffReopenApproved(
          staffEmail,
          programName,
          payPeriodLabel,
          loginUrl
        ).catch((e) => console.error('[reopen route] approved email error', e))
      } else {
        sendStaffReopenDenied(
          staffEmail,
          programName,
          payPeriodLabel
        ).catch((e) => console.error('[reopen route] denied email error', e))
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[POST /api/signee/timecards/[id]/reopen] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
