import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database.types'

const ALLOWED_DOMAIN = 'norwichpublicschools.org'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // If there is no code, something went wrong upstream
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?message=no_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore — middleware will handle session refresh
          }
        },
      },
    }
  )

  // Exchange the OAuth code for a session
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data.user) {
    console.error('OAuth code exchange error:', exchangeError?.message)
    return NextResponse.redirect(`${origin}/auth/error?message=exchange_failed`)
  }

  const user = data.user
  const email: string = user.email ?? ''

  // -------------------------------------------------------------------------
  // Domain validation — only @norwichpublicschools.org accounts are allowed
  // -------------------------------------------------------------------------
  if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/auth/error?message=domain`)
  }

  // -------------------------------------------------------------------------
  // Upsert the user profile in the public.users table
  // -------------------------------------------------------------------------
  const fullName: string =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    email.split('@')[0]

  // Use the admin client for the upsert so that the typed Database schema
  // resolves correctly and RLS doesn't block the write.
  const adminClient = createAdminClient()
  const { error: upsertError } = await adminClient.from('users').upsert(
    {
      id: user.id,
      email,
      full_name: fullName,
      role: 'staff' as const, // default role; admins must be promoted manually
    },
    {
      // Do not overwrite an existing role on subsequent logins
      onConflict: 'id',
      ignoreDuplicates: false,
    }
  )

  if (upsertError) {
    // Non-fatal: log but don't block the user
    console.error('User upsert error:', upsertError.message)
  }

  // Redirect to root — the middleware / root page will route to the right portal
  return NextResponse.redirect(`${origin}/`)
}
