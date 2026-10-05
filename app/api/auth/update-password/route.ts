import { NextResponse } from 'next/server'
import { createClient, supabaseAdmin } from '@/lib/supabase/server'
import { isSuperAdminUser, isStaffUser } from '@/lib/auth/roles'

export async function POST(request: Request) {
  try {
    const { password, userId } = await request.json()

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      )
    }

    // 1. Enforce session-based user authentication
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: an active authenticated session is required.' },
        { status: 401 }
      )
    }

    // Determine target user id with strict authorization check
    let targetUserId = user.id

    if (userId && userId !== user.id) {
      // Cross-user password change requires verified admin role
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const isSuperAdmin = isSuperAdminUser(user, profile)
      const isStaff = isStaffUser(user, profile)

      if (!isSuperAdmin && !isStaff) {
        return NextResponse.json(
          { error: 'Forbidden: Admin privileges required to update other accounts.' },
          { status: 403 }
        )
      }

      targetUserId = userId
    }

    // 2. Update password using admin API for guaranteed persistence
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password }
    )

    if (updateError) {
      console.error('[GhostCRM Auth] Failed to update user password:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully.'
    })
  } catch (err: any) {
    console.error('[GhostCRM Auth] Update password error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error while updating password.' },
      { status: 500 }
    )
  }
}
