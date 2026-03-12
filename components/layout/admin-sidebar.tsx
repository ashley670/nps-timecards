'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  DollarSign,
  CalendarDays,
  Briefcase,
  FileBarChart,
  ChevronRight,
  Users,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  children?: { label: string; href: string }[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Programs',
    href: '/admin/programs',
    icon: Briefcase,
  },
  {
    label: 'Pay Periods',
    href: '/admin/pay-periods',
    icon: CalendarDays,
  },
  {
    label: 'NTL Rate',
    href: '/admin/ntl-rate',
    icon: DollarSign,
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: FileBarChart,
    children: [
      { label: 'By Pay Period', href: '/admin/reports/pay-period' },
      { label: 'By Program', href: '/admin/reports/program' },
      { label: 'By Staff Member', href: '/admin/reports/staff' },
    ],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-gray-50">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-sm font-semibold text-gray-900">NPS Timecards</span>
        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
          Admin
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.children && (
                    <ChevronRight className="h-3 w-3 opacity-50" />
                  )}
                </Link>
                {item.children && isActive && (
                  <ul className="ml-7 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={cn(
                            'block rounded-md px-3 py-1.5 text-sm transition-colors',
                            pathname === child.href
                              ? 'bg-blue-100 font-medium text-blue-700'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t px-6 py-4">
        <p className="text-xs text-gray-500">Norwich Public Schools</p>
      </div>
    </aside>
  )
}
