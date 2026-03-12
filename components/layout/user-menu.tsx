'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getInitials } from '@/lib/utils'

interface UserMenuProps {
  /** Optional: pre-fetched user info. If omitted, fetched from Supabase session. */
  name?: string
  email?: string
  avatarUrl?: string
  profileHref?: string
}

export function UserMenu({
  name,
  email,
  avatarUrl,
  profileHref = '/staff/profile',
}: UserMenuProps) {
  const router = useRouter()
  const [userData, setUserData] = React.useState<{
    name: string
    email: string
    avatarUrl: string
  }>({
    name: name ?? '',
    email: email ?? '',
    avatarUrl: avatarUrl ?? '',
  })
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  // Fetch user data from Supabase session if not provided
  React.useEffect(() => {
    if (name && email) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const meta = user.user_metadata ?? {}
      setUserData({
        name: name ?? meta.full_name ?? meta.name ?? user.email ?? '',
        email: email ?? user.email ?? '',
        avatarUrl: avatarUrl ?? meta.avatar_url ?? meta.picture ?? '',
      })
    })
  }, [name, email, avatarUrl])

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
      router.refresh()
    } catch {
      setIsSigningOut(false)
    }
  }

  const initials = userData.name ? getInitials(userData.name) : '??'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            {userData.avatarUrl && (
              <AvatarImage src={userData.avatarUrl} alt={userData.name} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-gray-700 sm:block">
            {userData.name || userData.email}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {userData.name && (
              <p className="text-sm font-medium leading-none">{userData.name}</p>
            )}
            {userData.email && (
              <p className="text-xs leading-none text-muted-foreground">
                {userData.email}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={profileHref} className="flex cursor-pointer items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
