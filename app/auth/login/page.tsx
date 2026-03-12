import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmailLoginForm } from '@/components/auth/email-login-form'
import type { UserRole } from '@/types/app.types'

export const metadata = {
  title: 'Sign In | NPS Timesheet Management',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role as UserRole | undefined
    if (role === 'district_admin') redirect('/admin')
    if (role === 'staff') redirect('/dashboard')
    if (role === 'signee') redirect('/signee')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white text-2xl font-bold shadow-md">
            NPS
          </div>
          <h1 className="text-xl font-bold text-blue-700 tracking-tight">
            Norwich Public Schools
          </h1>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-2xl font-bold">
              Timesheet Management System
            </CardTitle>
            <CardDescription className="text-base">
              Sign in with your district email address
            </CardDescription>
          </CardHeader>

          <CardContent>
            <EmailLoginForm
              error={searchParams.error}
              message={searchParams.message}
            />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Norwich Public Schools. All rights reserved.
        </p>
      </div>
    </main>
  )
}
