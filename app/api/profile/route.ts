import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required').max(255).trim(),
  city: z.string().min(1, 'City is required').max(100).trim(),
  state: z
    .string()
    .length(2, 'State must be a 2-letter abbreviation')
    .toUpperCase()
    .trim(),
  zip: z
    .string()
    .regex(
      /^\d{5}(-\d{4})?$/,
      'Enter a valid ZIP code (e.g. 06360 or 06360-1234)'
    )
    .trim(),
})

type AddressInput = z.infer<typeof addressSchema>

/** Compose a single address string from the validated fields */
function formatAddress(data: AddressInput): string {
  return `${data.street}, ${data.city}, ${data.state} ${data.zip}`
}

// ---------------------------------------------------------------------------
// PATCH /api/profile  — update address for the authenticated user
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  // 1. Parse request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 2. Validate with zod
  const parsed = addressSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    )
  }

  // 3. Build a server Supabase client (cookie-based auth)
  const supabase = await createClient()

  // 4. Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 5. Update the users table
  const addressString = formatAddress(parsed.data)

  const { error: updateError } = await supabase
    .from('users')
    .update({ address: addressString, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updateError) {
    console.error('Profile update error:', updateError.message)
    return NextResponse.json(
      { error: 'Failed to update address. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, address: addressString })
}

// ---------------------------------------------------------------------------
// POST /api/profile  — upsert user record on email/password signup
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  let body: { id?: string; email?: string; full_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.id || !body.email) {
    return NextResponse.json({ error: 'id and email required' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin.from('users').upsert(
    {
      id: body.id,
      email: body.email,
      full_name: body.full_name ?? body.email.split('@')[0],
      role: 'staff',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  if (error) {
    console.error('Profile upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
