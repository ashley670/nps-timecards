import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Briefcase,
  Users,
  UserCheck,
  ClipboardList,
  CheckCircle,
  DollarSign,
  CalendarDays,
  FileBarChart,
  ArrowRight,
} from 'lucide-react'
import { getFiscalYear } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}

function StatCard({ label, value, icon: Icon, iconColor }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={`rounded-full p-3 ${iconColor}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface QuickLinkProps {
  href: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

function QuickLink({ href, label, description, icon: Icon }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-blue-200"
    >
      <div className="rounded-md bg-blue-50 p-2 text-blue-600 group-hover:bg-blue-100">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
    </Link>
  )
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const currentFY = getFiscalYear()

  // Fetch all stats in parallel
  const [
    { count: totalPrograms },
    { count: totalStaff },
    { count: totalSignees },
    { count: pendingTimecards },
    { count: signedTimecards },
  ] = await Promise.all([
    supabase
      .from('programs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'staff'),
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'signee'),
    supabase
      .from('timecards')
      .select('*', { count: 'exact', head: true })
      .in('status', ['submitted', 'reopen_requested']),
    supabase
      .from('timecards')
      .select(
        `*, pay_periods!inner(fiscal_year)`,
        { count: 'exact', head: true }
      )
      .eq('status', 'signed')
      .eq('pay_periods.fiscal_year', String(currentFY)),
  ])

  const stats: StatCardProps[] = [
    {
      label: 'Active Programs',
      value: totalPrograms ?? 0,
      icon: Briefcase,
      iconColor: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Total Staff',
      value: totalStaff ?? 0,
      icon: Users,
      iconColor: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Total Signees',
      value: totalSignees ?? 0,
      icon: UserCheck,
      iconColor: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Pending Timecards',
      value: pendingTimecards ?? 0,
      icon: ClipboardList,
      iconColor: 'bg-yellow-100 text-yellow-600',
    },
    {
      label: `Signed Timecards (FY${currentFY})`,
      value: signedTimecards ?? 0,
      icon: CheckCircle,
      iconColor: 'bg-green-100 text-green-600',
    },
  ]

  const quickLinks: QuickLinkProps[] = [
    {
      href: '/admin/ntl-rate',
      label: 'NTL Rate',
      description: 'View and update the non-traditional learning hourly rate',
      icon: DollarSign,
    },
    {
      href: '/admin/pay-periods',
      label: 'Pay Periods',
      description: 'Manage pay periods and upload CSV schedules',
      icon: CalendarDays,
    },
    {
      href: '/admin/programs',
      label: 'Programs',
      description: 'Manage programs, staff assignments, and signees',
      icon: Briefcase,
    },
    {
      href: '/admin/reports',
      label: 'Reports',
      description: 'Generate and download PDF timecard reports',
      icon: FileBarChart,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of the Norwich Public Schools NTL timecard system — FY {currentFY - 1}–{currentFY}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Quick Links</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <QuickLink key={link.href} {...link} />
          ))}
        </div>
      </div>

      {/* CTA row */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/admin/programs/new">Create New Program</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/pay-periods">Upload Pay Periods</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/reports">Generate Reports</Link>
        </Button>
      </div>
    </div>
  )
}
