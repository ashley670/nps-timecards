// =============================================================================
// app/api/signee/programs/route.ts
// GET — returns distinct programs where current user is a signee,
//        with count of submitted timecards per program.
// =============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch all program_signees rows for this user
    const { data: signeeRows, error: signeeError } = await supabase
      .from('program_signees')
      .select('program_id, staff_id')
      .eq('signee_id', user.id)

    if (signeeError) {
      console.error('[GET /api/signee/programs] signee rows', signeeError)
      return NextResponse.json({ error: signeeError.message }, { status: 500 })
    }

    const programIds = Array.from(
      new Set((signeeRows ?? []).map((r) => r.program_id))
    )

    if (!programIds.length) {
      return NextResponse.json([])
    }

    // 2. Fetch programs
    const { data: programs, error: programsError } = await supabase
      .from('programs')
      .select('id, name, account_number, is_active')
      .in('id', programIds)
      .eq('is_active', true)
      .order('name')

    if (programsError) {
      console.error('[GET /api/signee/programs] programs', programsError)
      return NextResponse.json({ error: programsError.message }, { status: 500 })
    }

    if (!programs || programs.length === 0) {
      return NextResponse.json([])
    }

    // 3. Fetch submitted timecards for these programs
    const { data: timecards, error: tcError } = await supabase
      .from('timecards')
      .select('id, program_id, staff_id, status')
      .in('program_id', programIds)
      .eq('status', 'submitted')

    if (tcError) {
      console.error('[GET /api/signee/programs] timecards', tcError)
      // Non-fatal — return programs with 0 counts
    }

    // 4. Filter timecards by access rule and build per-program counts
    const submittedByProgram: Record<string, number> = {}

    for (const tc of timecards ?? []) {
      const hasAccess = (signeeRows ?? []).some(
        (r) =>
          r.program_id === tc.program_id &&
          (r.staff_id === null || r.staff_id === tc.staff_id)
      )
      if (!hasAccess) continue
      submittedByProgram[tc.program_id] =
        (submittedByProgram[tc.program_id] ?? 0) + 1
    }

    // 5. Build response
    const result = programs.map((p) => ({
      ...p,
      submitted_count: submittedByProgram[p.id] ?? 0,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/signee/programs] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
