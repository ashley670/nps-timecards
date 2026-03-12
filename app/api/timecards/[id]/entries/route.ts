// =============================================================================
// app/api/timecards/[id]/entries/route.ts
// PUT – replace all entries for a timecard (draft/reopened only)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// PUT /api/timecards/[id]/entries
// Body: { entries: [{ work_date, time_in, time_out, total_hours }] }
// Validates timecard ownership and editable status.
// Deletes all existing entries, inserts the new ones.
// ---------------------------------------------------------------------------
export async function PUT(
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
    const { entries } = body

    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })
    }

    // Validate each entry has required fields
    for (const entry of entries) {
      if (!entry.work_date || !entry.time_in || !entry.time_out) {
        return NextResponse.json(
          { error: 'Each entry must have work_date, time_in, and time_out' },
          { status: 400 }
        )
      }
    }

    // Fetch timecard to verify ownership and status
    const { data: timecard } = await supabase
      .from('timecards')
      .select('id, staff_id, status')
      .eq('id', params.id)
      .single()

    if (!timecard) {
      return NextResponse.json({ error: 'Timecard not found' }, { status: 404 })
    }

    if (timecard.staff_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const editableStatuses = ['draft', 'reopened']
    if (!editableStatuses.includes(timecard.status)) {
      return NextResponse.json(
        { error: 'Timecard is not editable in its current status' },
        { status: 409 }
      )
    }

    // Delete existing entries
    const { error: deleteError } = await supabaseAdmin
      .from('timecard_entries')
      .delete()
      .eq('timecard_id', params.id)

    if (deleteError) {
      console.error('[PUT /api/timecards/[id]/entries] delete', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Insert new entries
    let insertedEntries: unknown[] = []

    if (entries.length > 0) {
      const insertRows = (
        entries as Array<{
          work_date: string
          time_in: string
          time_out: string
          total_hours: number
        }>
      ).map((e) => ({
        timecard_id: params.id,
        work_date: e.work_date,
        time_in: e.time_in,
        time_out: e.time_out,
        total_hours: typeof e.total_hours === 'number' ? e.total_hours : 0,
      }))

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('timecard_entries')
        .insert(insertRows)
        .select()

      if (insertError) {
        console.error('[PUT /api/timecards/[id]/entries] insert', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      insertedEntries = inserted ?? []
    }

    // Touch the timecard updated_at
    await supabaseAdmin
      .from('timecards')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ entries: insertedEntries })
  } catch (err) {
    console.error('[PUT /api/timecards/[id]/entries] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
