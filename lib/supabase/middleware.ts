import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSuperAdminUser, isStaffUser } from '@/lib/auth/roles'

export async function updateSession(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 1. Protected Route Rule: /crm, /admin, /courier require authenticated session
  const isCrmRoute = pathname.startsWith('/crm')
  const isAdminRoute = pathname.startsWith('/admin')
  const isCourierRoute = pathname.startsWith('/courier')
  const isAuthRoute = pathname === '/login' || pathname === '/register'

  // If user is not authenticated and attempts to access protected routes, redirect to /login
  if (!user && (isCrmRoute || isAdminRoute || isCourierRoute)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 2. Role-Based Access Control (RBAC)
  if (user) {
    // If authenticated user visits login or register, redirect to appropriate portal
    if (isAuthRoute) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const isSuper = isSuperAdminUser(user)
      if (isStaffUser(user, profile)) {
        return NextResponse.redirect(new URL('/crm', request.url))
      }
      return NextResponse.redirect(new URL('/courier', request.url))
    }

    // Strict OPSEC: Only 'admin', 'super_admin', or 'warehouseman' role can access /crm or /admin
    if (isCrmRoute || isAdminRoute) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!isStaffUser(user, profile)) {
        console.warn(`[OPSEC] Unauthorized user ${user.id} (${user.email}) attempted to access ${pathname}`)
        // Couriers or non-admins are restricted to /courier
        return NextResponse.redirect(new URL('/courier', request.url))
      }
    }
  }

  return supabaseResponse
}
