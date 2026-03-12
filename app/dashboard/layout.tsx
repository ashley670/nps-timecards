import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StaffNavbar } from '@/components/layout/staff-navbar'
import { ProfileSetupModal } from '@/components/auth/profile-setup-modal'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name, address')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'staff') {
    redirect('/')
  }

  const needsProfileSetup = !profile.address

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <StaffNavbar />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      {needsProfileSetup && <ProfileSetupModal />}
    </div>
  )
}
