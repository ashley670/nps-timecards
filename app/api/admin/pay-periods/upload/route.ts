// =============================================================================
// app/api/admin/pay-periods/upload/route.ts
// GET  – returns all pay periods (used by the Pay Periods admin page)
// POST – bulk-inserts pay period rows from a CSV upload preview
//        Body: { rows: [{ label, start_date, end_date }] }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const d = new Date(str)
  return !isNaN(d.getTime())
}

/**
 * NPS fiscal year: July 1 – June 30.
 * Returns the 4-digit fiscal year end (e.g. "2025").
 */
function getFiscalYear(dateStr: string): string {
  const date = new Date(dateStr)
  const month = date.getMonth() // 0-indexed
  const year = date.getFullYear()
  return month >= 6 ? String(year + 1) : String(year)
}

interface CsvRow {
  label: string
  start_date: string
  end_date: string
}

interface SkippedRow {
  index: number
  row: CsvRow
  reason: string
}

// ---------------------------------------------------------------------------
// GET /api/admin/pay-periods/upload
// (Re-uses this file as the data endpoint for the Pay Periods page)
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('pay_periods')
      .select('*, program_pay_periods(count)')
      .order('start_date', { ascending: false })

    if (error) {
      console.error('[pay-periods/upload GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[pay-periods/upload GET] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/pay-periods/upload
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rows: CsvRow[] = body?.rows

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch a district_admin user to satisfy created_by NOT NULL
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'district_admin')
      .limit(1)
      .single()

    const created_by = adminUser?.id ?? '00000000-0000-0000-0000-000000000000'

    // Fetch existing pay periods to detect duplicates
    const { data: existing } = await supabase
      .from('pay_periods')
      .select('start_date, end_date')

    const existingSet = new Set(
      (existing ?? []).map((p) => `${p.start_date}|${p.end_date}`)
    )

    const toInsert: typeof rows = []
    const skipped: SkippedRow[] = []

    rows.forEach((row, index) => {
      // Validate label
      if (!row.label || !row.label.trim()) {
        skipped.push({ index, row, reason: 'label is empty' })
        return
      }
      // Validate start_date
      if (!isValidDate(row.start_date)) {
        skipped.push({ index, row, reason: `invalid start_date "${row.start_date}"` })
        return
      }
      // Validate end_date
      if (!isValidDate(row.end_date)) {
        skipped.push({ index, row, reason: `invalid end_date "${row.end_date}"` })
        return
      }
      // Validate order
      if (new Date(row.end_date) <= new Date(row.start_date)) {
        skipped.push({ index, row, reason: 'end_date must be after start_date' })
        return
      }
      // Check duplicate
      const key = `${row.start_date}|${row.end_date}`
      if (existingSet.has(key)) {
        skipped.push({ index, row, reason: 'duplicate (same start_date + end_date already exists)' })
        return
      }
      // Track so we don't insert duplicates from the same batch
      existingSet.add(key)
      toInsert.push(row)
    })

    let inserted = 0

    if (toInsert.length > 0) {
      const insertPayload = toInsert.map((row) => ({
        label: row.label.trim(),
        start_date: row.start_date,
        end_date: row.end_date,
        fiscal_year: getFiscalYear(row.start_date),
        created_by,
      }))

      const { data: insertedRows, error: insertError } = await supabase
        .from('pay_periods')
        .insert(insertPayload)
        .select()

      if (insertError) {
        console.error('[pay-periods/upload POST]', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      inserted = insertedRows?.length ?? 0
    }

    return NextResponse.json({ inserted, skipped })
  } catch (err) {
    console.error('[pay-periods/upload POST] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
