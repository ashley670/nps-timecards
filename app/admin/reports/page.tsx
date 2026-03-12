import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, Briefcase, User, FileBarChart } from 'lucide-react'

const reportCards = [
  {
    title: 'By Pay Period',
    description:
      'Generate a consolidated PDF of all signed timecards for a selected pay period across all programs.',
    href: '/admin/reports/pay-period',
    icon: CalendarDays,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'By Program',
    description:
      'Export all signed timecards for a specific program, optionally filtered by a single pay period.',
    href: '/admin/reports/program',
    icon: Briefcase,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    title: 'By Staff Member',
    description:
      'Search for a staff member and generate a report of their signed timecards, with optional program and pay period filters.',
    href: '/admin/reports/staff',
    icon: User,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileBarChart className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Generate and download PDF reports of signed timecards by pay period, program, or staff member.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportCards.map((card) => {
          const Icon = card.icon
          return (
            <Card
              key={card.href}
              className="flex flex-col hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {card.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <Button asChild className="w-full">
                  <Link href={card.href}>Generate Report</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-8 rounded-lg border bg-gray-50 p-4">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Reports only include timecards with status &quot;signed&quot;.
          Drafts, submitted, and reopened timecards are excluded from PDF exports.
        </p>
      </div>
    </div>
  )
}
