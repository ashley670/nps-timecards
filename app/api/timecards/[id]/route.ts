// =============================================================================
// app/api/timecards/[id]/route.ts
// GET   – returns single timecard with entries (validates ownership)
// PATCH – handles action='submit' or action='save'
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTimecardPdf, getTimecardPdfFilename } from '@/lib/pdf/generate-timecard'
import { sendSigneeTimecardSubmitted } from '@/lib/email/send'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ---------------------------------------------------------------------------
// GET /api/timecards/[id]
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: timecard, error } = await supabase
      .from('timecards')
      .select(`
        *,
        timecard_entries (*)
      `)
      .eq('id', params.id)
      .single()

    if (error || !timecard) {
      return NextResponse.json({ error: 'Timecard not found' }, { status: 404 })
    }

    if (timecard.staff_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(timecard)
  } catch (err) {
    console.error('[GET /api/timecards/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/timecards/[id]
// Body: { action: 'submit' | 'save', entries, staff_signature? }
// ---------------------------------------------------------------------------
export async function PATCH(
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
    const { action, entries = [], staff_signature } = body

    if (!action || !['submit', 'save'].includes(action)) {
      return NextResponse.json({ error: 'action must be submit or save' }, { status: 400 })
    }

    // Fetch timecard to verify ownership + status
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

    const editableStatuses = ['draft', 'reopened']
    if (!editableStatuses.includes(timecard.status)) {
      return NextResponse.json(
        { error: 'Timecard is not editable in its current status' },
        { status: 409 }
      )
    }

    // -------------------------------------------------------------------------
    // Save entries first (shared by both actions)
    // -------------------------------------------------------------------------
    if (entries.length > 0) {
      // Delete existing entries
      await supabaseAdmin
        .from('timecard_entries')
        .delete()
        .eq('timecard_id', params.id)

      // Insert new entries
      const insertRows = (entries as Array<{
        work_date: string
        time_in: string
        time_out: string
        total_hours: number
      }>).map((e) => ({
        timecard_id: params.id,
        work_date: e.work_date,
        time_in: e.time_in,
        time_out: e.time_out,
        total_hours: e.total_hours,
      }))

      if (insertRows.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('timecard_entries')
          .insert(insertRows)

        if (insertError) {
          console.error('[PATCH /api/timecards/[id]] insert entries', insertError)
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
      }
    }

    // -------------------------------------------------------------------------
    // action='save' — just update entries, no status change
    // -------------------------------------------------------------------------
    if (action === 'save') {
      const { data: updated, error: saveError } = await supabaseAdmin
        .from('timecards')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .select()
        .single()

      if (saveError) {
        return NextResponse.json({ error: saveError.message }, { status: 500 })
      }
      return NextResponse.json(updated)
    }

    // -------------------------------------------------------------------------
    // action='submit' — validate signature, set status, generate PDF, email
    // -------------------------------------------------------------------------
    if (!staff_signature?.trim()) {
      return NextResponse.json({ error: 'staff_signature is required' }, { status: 400 })
    }

    const signedAt = new Date().toISOString()

    // Update timecard status
    const { data: updatedTimecard, error: updateError } = await supabaseAdmin
      .from('timecards')
      .update({
        status: 'submitted',
        submitted_at: signedAt,
        staff_signature: staff_signature.trim(),
        staff_signed_at: signedAt,
        updated_at: signedAt,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError || !updatedTimecard) {
      console.error('[PATCH /api/timecards/[id]] update status', updateError)
      return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
    }

    // -------------------------------------------------------------------------
    // Generate PDF + upload to storage (fire-and-forget on failure)
    // -------------------------------------------------------------------------
    try {
      // Gather data for PDF
      const [programRes, payPeriodRes, staffRes, entriesRes, ntlRateRes] = await Promise.all([
        supabaseAdmin.from('programs').select('name, account_number').eq('id', timecard.program_id).single(),
        supabaseAdmin.from('pay_periods').select('*').eq('id', timecard.pay_period_id).single(),
        supabaseAdmin.from('users').select('full_name, address').eq('id', user.id).single(),
        supabaseAdmin.from('timecard_entries').select('*').eq('timecard_id', params.id).order('work_date'),
        supabaseAdmin
          .from('ntl_rates')
          .select('rate')
          .eq('fiscal_year', String(new Date().getFullYear()))
          .order('set_at', { ascending: false })
          .limit(1)
          .single(),
      ])

      const prog = programRes.data
      const pp = payPeriodRes.data
      const staff = staffRes.data
      const tcEntries = entriesRes.data ?? []

      // Find signee
      const { data: signeeAssignment } = await supabaseAdmin
        .from('program_signees')
        .select(`
          signee_id,
          users!program_signees_signee_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('program_id', timecard.program_id)
        .or(`staff_id.eq.${user.id},staff_id.is.null`)
        .limit(1)
        .single()

      const signeeUser = signeeAssignment?.users as unknown as {
        id: string
        full_name: string
        email: string
      } | null

      if (prog && pp && staff) {
        const pdfData = {
          programName: prog.name,
          accountNumber: prog.account_number,
          payPeriodLabel: pp.label,
          payPeriodStart: pp.start_date,
          payPeriodEnd: pp.end_date,
          staffName: staff.full_name,
          staffSchool: '',
          staffAddress: staff.address ?? '',
          entries: tcEntries.map((e) => ({
            work_date: e.work_date,
            time_in: e.time_in,
            time_out: e.time_out,
            total_hours: e.total_hours,
          })),
          staffSignature: staff_signature.trim(),
          staffSignedAt: signedAt,
          signeeName: signeeUser?.full_name ?? null,
          signeeSignature: null,
          signeeSignedAt: null,
          ntlRate: ntlRateRes.data?.rate ?? null,
          status: 'submitted' as const,
        }

        const pdfBuffer = await generateTimecardPdf(pdfData)
        const filename = getTimecardPdfFilename(staff.full_name, pp.label)
        const storagePath = `${user.id}/${params.id}/${filename}`

        const { data: uploadData } = await supabaseAdmin.storage
          .from('timecard-pdfs')
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          })

        if (uploadData?.path) {
          const { data: urlData } = supabaseAdmin.storage
            .from('timecard-pdfs')
            .getPublicUrl(uploadData.path)

          await supabaseAdmin
            .from('timecards')
            .update({
              pdf_url: urlData?.publicUrl ?? null,
              signee_id: signeeUser?.id ?? null,
            })
            .eq('id', params.id)
        }

        // Send email to signee
        if (signeeUser?.email) {
          const signUrl = `${APP_URL}/signee/timecards/${params.id}`
          sendSigneeTimecardSubmitted(
            signeeUser.email,
            staff.full_name,
            prog.name,
            pp.label,
            signUrl
          ).catch((e) => console.error('[PATCH submit] email', e))
        }
      }
    } catch (pdfErr) {
      // PDF/email failure is non-fatal — timecard is already submitted
      console.error('[PATCH submit] PDF/email error (non-fatal):', pdfErr)
    }

    return NextResponse.json(updatedTimecard)
  } catch (err) {
    console.error('[PATCH /api/timecards/[id]] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
