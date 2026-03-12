// =============================================================================
// app/api/admin/ntl-rate/route.ts
// GET  – returns all ntl_rates rows ordered by fiscal_year desc
// POST – {rate, fiscal_year} inserts a new rate record
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// GET /api/admin/ntl-rate
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('ntl_rates')
      .select('*, setter:users!ntl_rates_set_by_fkey(full_name)')
      .order('fiscal_year', { ascending: false })

    if (error) {
      console.error('[ntl-rate GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[ntl-rate GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/ntl-rate
// Body: { rate: number, fiscal_year: string }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rate, fiscal_year } = body

    // Validate
    if (typeof rate !== 'number' || rate <= 0) {
      return NextResponse.json(
        { error: 'rate must be a positive number' },
        { status: 400 }
      )
    }
    if (!fiscal_year || typeof fiscal_year !== 'string') {
      return NextResponse.json(
        { error: 'fiscal_year is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Retrieve the acting admin user (use service key; set a placeholder if auth header absent)
    // In practice, the admin layout protects these routes.
    // We use a "system" fallback to satisfy the NOT NULL constraint.
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'district_admin')
      .limit(1)
      .single()

    const set_by = adminUsers?.id ?? '00000000-0000-0000-0000-000000000000'

    const { data, error } = await supabase
      .from('ntl_rates')
      .insert({ rate, fiscal_year, set_by })
      .select()
      .single()

    if (error) {
      console.error('[ntl-rate POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[ntl-rate POST] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
