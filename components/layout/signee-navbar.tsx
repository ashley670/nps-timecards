'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UserMenu } from '@/components/layout/user-menu'
import { PenLine } from 'lucide-react'

interface NavLink {
  label: string
  href: string
}

const navLinks: NavLink[] = [
  { label: 'Dashboard', href: '/signee' },
  { label: 'Batch Signing', href: '/signee/batch' },
]

export function SigneeNavbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white shadow-sm">
      <div className="flex h-16 items-center px-6">
        {/* Logo / Brand */}
        <Link
          href="/signee"
          className="mr-6 flex items-center gap-2"
        >
          <PenLine className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-base font-bold tracking-tight text-gray-900">
            NPS
          </span>
          <span className="hidden text-sm font-normal text-gray-500 sm:inline">
            Signee Portal
          </span>
        </Link>

        {/* Nav Links */}
        <nav className="flex flex-1 items-center gap-1">
          {navLinks.map(({ label, href }) => {
            const isActive =
              href === '/signee'
                ? pathname === '/signee'
                : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User Avatar / Menu */}
        <UserMenu profileHref="/signee/profile" />
      </div>
    </header>
  )
}
