import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  const role = profile?.role as UserRole | undefined

  if (role === 'district_admin') redirect('/admin')
  if (role === 'staff') redirect('/dashboard')
  if (role === 'signee') redirect('/signee')

  // Fallback: role not yet assigned — send to login with a message
  redirect('/auth/login')
}
