// =============================================================================
// app/api/admin/users/route.ts
// GET – returns users with optional ?role=signee|staff|district_admin and ?search=query
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')
    const search = searchParams.get('search')?.trim()

    const supabase = createAdminClient()

    let query = supabase
      .from('users')
      .select('id, email, full_name, role, created_at')
      .order('full_name', { ascending: true })

    if (role) {
      query = query.eq('role', role)
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('[users GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[users GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
