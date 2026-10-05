import { NextResponse } from 'next/server'
import { createClient, supabaseAdmin } from '@/lib/supabase/server'
import { isSuperAdminUser, isStaffUser } from '@/lib/auth/roles'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: an active authenticated session is required.' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, phone_number')
      .eq('id', user.id)
      .single()

    const meta = user.user_metadata || {}
    const displayName =
      meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Admin')
    const phoneNumber = profile?.phone_number || meta.phone_number || ''
    const telegramId = meta.telegram_id || ''

    const isSuperAdmin = isSuperAdminUser(user, profile)
    const userRole = profile?.role || meta.role
    const roleTitle = isSuperAdmin
      ? 'Super Admin'
      : userRole === 'warehouseman'
      ? 'Warehouse Manager'
      : userRole === 'admin'
      ? 'Dispatcher'
      : 'Courier Driver'

    return NextResponse.json({
      ok: true,
      profile: {
        id: user.id,
        email: user.email,
        role: roleTitle,
        is_super_admin: isSuperAdmin,
        name: displayName,
        phone_number: phoneNumber,
        telegram_id: telegramId
      }
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch user profile.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { name, phone_number, telegram_id, userId } = await request.json()

    // 1. Enforce session-based user authentication
    const supabase = await createClient()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: an active authenticated session is required.' },
        { status: 401 }
      )
    }

    // Determine target user ID with strict role authorization
    let targetUserId = user.id

    if (userId && userId !== user.id) {
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

    // 2. Fetch target user to merge existing metadata cleanly
    const { data: targetUserObj, error: fetchErr } =
      await supabaseAdmin.auth.admin.getUserById(targetUserId)

    if (fetchErr || !targetUserObj?.user) {
      return NextResponse.json(
        { error: 'Target user not found.' },
        { status: 404 }
      )
    }

    const updatedMetadata = {
      ...(targetUserObj.user.user_metadata || {}),
      name: (name || '').trim(),
      full_name: (name || '').trim(),
      phone_number: (phone_number || '').trim(),
      telegram_id: (telegram_id || '').trim()
    }

    // 3. Persist into Supabase Auth user_metadata
    const { data: updatedUser, error: updateAuthErr } =
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: updatedMetadata
      })

    if (updateAuthErr) {
      console.error('[GhostCRM Profile] Failed to update user metadata:', updateAuthErr)
      return NextResponse.json(
        { error: updateAuthErr.message || 'Failed to update user profile.' },
        { status: 400 }
      )
    }

    // 4. Persist phone_number into public.profiles table
    if (phone_number !== undefined) {
      const cleanPhone = (phone_number || '').trim()
      const { error: profileTableErr } = await supabaseAdmin
        .from('profiles')
        .update({ phone_number: cleanPhone || null })
        .eq('id', targetUserId)

      if (profileTableErr) {
        console.warn('[GhostCRM Profile] Note: failed to update profiles table phone:', profileTableErr.message)
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Profile details saved successfully in database.',
      user: {
        id: targetUserId,
        email: updatedUser.user.email,
        name: updatedMetadata.name,
        phone_number: updatedMetadata.phone_number,
        telegram_id: updatedMetadata.telegram_id
      }
    })
  } catch (err: any) {
    console.error('[GhostCRM Profile] Unhandled error updating profile:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error while updating profile.' },
      { status: 500 }
    )
  }
}
