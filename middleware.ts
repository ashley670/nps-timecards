import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/types/app.types'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — IMPORTANT: do not run any other logic between
  // createServerClient and supabase.auth.getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // -------------------------------------------------------------------------
  // Helper: create a redirect response that preserves set-cookie headers
  // -------------------------------------------------------------------------
  function redirect(path: string) {
    const url = request.nextUrl.clone()
    url.pathname = path
    const res = NextResponse.redirect(url)
    // Copy any session cookies set during the refresh
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value, cookie as Parameters<typeof res.cookies.set>[2])
    })
    return res
  }

  // -------------------------------------------------------------------------
  // Resolve user role
  // -------------------------------------------------------------------------
  let role: UserRole | null = null

  if (user) {
    // Prefer role stored in user_metadata to avoid an extra DB round-trip
    const metaRole = user.user_metadata?.role as UserRole | undefined
    if (metaRole && ['district_admin', 'staff', 'signee'].includes(metaRole)) {
      role = metaRole
    } else {
      // Fall back to querying the users table
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      role = (data?.role as UserRole) ?? null
    }
  }

  // -------------------------------------------------------------------------
  // Route protection
  // -------------------------------------------------------------------------

  // /admin/* — must be authenticated + district_admin
  if (pathname.startsWith('/admin')) {
    if (!user) return redirect('/auth/login')
    if (role !== 'district_admin') return redirect('/')
    return supabaseResponse
  }

  // /dashboard/* — must be authenticated + staff
  if (pathname.startsWith('/dashboard')) {
    if (!user) return redirect('/auth/login')
    if (role !== 'staff') return redirect('/')
    return supabaseResponse
  }

  // /signee/* — must be authenticated + signee
  if (pathname.startsWith('/signee')) {
    if (!user) return redirect('/auth/login')
    if (role !== 'signee') return redirect('/')
    return supabaseResponse
  }

  // /profile/* — must be authenticated (any role)
  if (pathname.startsWith('/profile')) {
    if (!user) return redirect('/auth/login')
    return supabaseResponse
  }

  // / root — if authenticated, redirect to appropriate portal
  if (pathname === '/') {
    if (user && role) {
      if (role === 'district_admin') return redirect('/admin')
      if (role === 'staff') return redirect('/dashboard')
      if (role === 'signee') return redirect('/signee')
    }
    // Not authenticated — let app/page.tsx handle the redirect to /auth/login
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static  (static files)
     *  - _next/image   (image optimization)
     *  - favicon.ico
     *  - /auth/*       (login, callback, error pages)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/).*)',
  ],
}
