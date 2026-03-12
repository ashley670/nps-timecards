import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/types/app.types'

/**
 * Root page — server component.
 * Redirects unauthenticated users to /auth/login and authenticated users
 * to the portal matching their role.
 */
export default async function RootPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Resolve role from DB
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  let role = profile?.role as UserRole | undefined

  // If no profile exists yet, auto-create one (handles cases where
  // the signup profile upsert failed)
  if (!role) {
    try {
      const adminClient = createAdminClient()
      await adminClient.from('users').upsert(
        {
          id: user.id,
          email: user.email ?? '',
          full_name:
            (user.user_metadata?.full_name as string) ??
            (user.email ?? '').split('@')[0],
          role: 'staff',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      role = 'staff'
    } catch {
      redirect('/auth/login?error=Profile+setup+failed.+Please+contact+an+administrator.')
    }
  }

  if (role === 'district_admin') redirect('/admin')
  if (role === 'staff') redirect('/dashboard')
  if (role === 'signee') redirect('/signee')

  // Fallback
  redirect('/auth/login')
}
