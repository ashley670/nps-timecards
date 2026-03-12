import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SigneeNavbar } from '@/components/layout/signee-navbar'

export default async function SigneeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'signee') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SigneeNavbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
