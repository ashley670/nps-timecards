import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AddressForm } from './address-form'
import type { UserRole } from '@/types/app.types'

export const metadata = {
  title: 'My Profile | NPS Timesheet Management',
}

const ROLE_LABELS: Record<UserRole, string> = {
  district_admin: 'District Administrator',
  staff: 'Staff',
  signee: 'Signee',
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, email, full_name, address, role')
    .eq('id', authUser.id)
    .single()

  if (error || !profile) {
    redirect('/auth/login')
  }

  const roleLabel = ROLE_LABELS[profile.role as UserRole] ?? profile.role

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground">
            View your account details and update your mailing address.
          </p>
        </div>

        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your district account details</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Full Name
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {profile.full_name}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Email
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {profile.email}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Role
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {roleLabel}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Current Address
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {profile.address ?? (
                    <span className="italic text-muted-foreground">Not set</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Address update form */}
        <Card>
          <CardHeader>
            <CardTitle>Mailing Address</CardTitle>
            <CardDescription>
              This address is used on your timecards. Keep it up to date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddressForm currentAddress={profile.address} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
