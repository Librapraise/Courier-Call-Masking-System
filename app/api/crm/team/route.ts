import { NextResponse } from 'next/server'
import { createClient, supabaseAdmin } from '@/lib/supabase/server'
import { formatPhoneForStorage } from '@/lib/utils/phone'
import { ROOT_SUPER_ADMIN_EMAIL, isSuperAdminUser as checkIsSuperAdmin } from '@/lib/auth/roles'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'warehouseman' && !checkIsSuperAdmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required.' },
        { status: 403 }
      )
    }

    const isCallerSuperAdmin = checkIsSuperAdmin(user)

    // 1. Fetch all auth users
    const { data: authData, error: authListErr } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 100
    })

    if (authListErr) {
      throw new Error(`Failed to list auth users: ${authListErr.message}`)
    }

    // 2. Fetch profiles
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('*')

    // 3. Fetch crm_couriers roster
    const { data: crmCouriers } = await supabaseAdmin
      .from('crm_couriers')
      .select('*')

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    const teamMembers = (authData.users || []).map(u => {
      const p = profileMap.get(u.id)
      const meta = u.user_metadata || {}
      const isSuper = u.email === ROOT_SUPER_ADMIN_EMAIL || meta.role === 'super_admin' || meta.is_super_admin === true

      // Clean phone match with courier roster
      const userPhone = p?.phone_number || meta.phone_number || ''
      const cleanPhone = (userPhone || '').replace(/\D/g, '')

      const matchedCourier = (crmCouriers || []).find(c => {
        const cClean = (c.phone_number || '').replace(/\D/g, '')
        return cleanPhone && cClean && (cleanPhone.endsWith(cClean.slice(-9)) || cClean.endsWith(cleanPhone.slice(-9)))
      })

      let rawRole: 'super_admin' | 'admin' | 'warehouseman' | 'courier' = 'courier'
      let displayRole = 'Courier Driver'

      if (isSuper) {
        rawRole = 'super_admin'
        displayRole = 'Super Admin'
      } else if (p?.role === 'warehouseman' || meta.role === 'warehouseman') {
        rawRole = 'warehouseman'
        displayRole = 'Warehouse Manager'
      } else if (p?.role === 'admin' || meta.role === 'admin') {
        rawRole = 'admin'
        displayRole = 'Dispatcher'
      } else {
        rawRole = 'courier'
        displayRole = 'Courier Driver'
      }

      const displayName =
        meta.name ||
        meta.full_name ||
        matchedCourier?.name ||
        (u.email ? u.email.split('@')[0] : 'Team Member')

      const telegramId =
        meta.telegram_id ||
        (matchedCourier?.telegram_id ? String(matchedCourier.telegram_id) : '—')

      return {
        id: u.id,
        email: u.email || '—',
        name: displayName,
        role: displayRole,
        raw_role: rawRole,
        is_super_admin: isSuper,
        is_root_super_admin: u.email === ROOT_SUPER_ADMIN_EMAIL,
        phone: userPhone || matchedCourier?.phone_number || '—',
        telegram_id: telegramId,
        status: 'Active',
        created_at: u.created_at
      }
    })

    // Sort: Root Super Admin first, then other super admins, then dispatchers, then warehouse managers, then couriers
    teamMembers.sort((a, b) => {
      if (a.is_root_super_admin) return -1
      if (b.is_root_super_admin) return 1
      if (a.raw_role === 'super_admin' && b.raw_role !== 'super_admin') return -1
      if (b.raw_role === 'super_admin' && a.raw_role !== 'super_admin') return 1
      if (a.raw_role === 'admin' && (b.raw_role === 'warehouseman' || b.raw_role === 'courier')) return -1
      if (b.raw_role === 'admin' && (a.raw_role === 'warehouseman' || a.raw_role === 'courier')) return 1
      if (a.raw_role === 'warehouseman' && b.raw_role === 'courier') return -1
      if (b.raw_role === 'warehouseman' && a.raw_role === 'courier') return 1
      return (a.name || '').localeCompare(b.name || '')
    })

    return NextResponse.json({
      ok: true,
      isCallerSuperAdmin,
      teamMembers
    })
  } catch (err: any) {
    console.error('[CRM Team API] GET error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isCallerSuperAdmin = checkIsSuperAdmin(user)

    if (profile?.role !== 'admin' && profile?.role !== 'warehouseman' && !isCallerSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { action } = body

    // -------------------------------------------------------------------------
    // 1. INVITE / PROVISION TEAM MEMBER
    // -------------------------------------------------------------------------
    if (action === 'INVITE_MEMBER') {
      const { name, email, role, phone_number, telegram_id, password } = body

      if (!email || !email.trim()) {
        return NextResponse.json({ error: 'Email address is required.' }, { status: 400 })
      }
      if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Full name is required.' }, { status: 400 })
      }
      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
      }

      const targetRole: 'super_admin' | 'admin' | 'warehouseman' | 'courier' =
        role === 'super_admin'
          ? 'super_admin'
          : role === 'warehouseman'
          ? 'warehouseman'
          : role === 'courier'
          ? 'courier'
          : 'admin'

      // Only Super Admins can create other Super Admins
      if (targetRole === 'super_admin' && !isCallerSuperAdmin) {
        return NextResponse.json(
          { error: 'Only Super Admins can provision other Super Admins.' },
          { status: 403 }
        )
      }

      const formattedPhone = phone_number ? formatPhoneForStorage(phone_number) : null

      // Create Supabase Auth user
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: {
          name: name.trim(),
          full_name: name.trim(),
          role: targetRole,
          is_super_admin: targetRole === 'super_admin',
          phone_number: formattedPhone || undefined,
          telegram_id: telegram_id?.trim() || undefined
        }
      })

      if (createErr || !created.user) {
        return NextResponse.json(
          { error: createErr?.message || 'Failed to create user account.' },
          { status: 400 }
        )
      }

      const newUserId = created.user.id

      // Upsert profile record (profiles table check constraint allows: 'admin' | 'courier' | 'warehouseman')
      const dbRole = targetRole === 'courier' ? 'courier' : targetRole === 'warehouseman' ? 'warehouseman' : 'admin'
      const { error: profileUpsertErr } = await supabaseAdmin.from('profiles').upsert({
        id: newUserId,
        email: email.trim(),
        role: dbRole,
        phone_number: formattedPhone
      })

      // Graceful fallback if database constraint hasn't been migrated yet
      if (profileUpsertErr && dbRole === 'warehouseman') {
        await supabaseAdmin.from('profiles').upsert({
          id: newUserId,
          email: email.trim(),
          role: 'admin',
          phone_number: formattedPhone
        })
      }

      // If courier, also register into crm_couriers roster
      if (targetRole === 'courier') {
        const { data: existingCrmCourier } = await supabaseAdmin
          .from('crm_couriers')
          .select('id')
          .eq('phone_number', formattedPhone || '')
          .maybeSingle()

        if (!existingCrmCourier) {
          await supabaseAdmin.from('crm_couriers').insert({
            name: name.trim(),
            phone_number: formattedPhone,
            telegram_id: telegram_id ? Number(telegram_id) : null,
            is_active: true
          })
        }
      }

      return NextResponse.json({
        ok: true,
        success: true,
        member: {
          id: newUserId,
          name: name.trim(),
          email: email.trim(),
          role: targetRole,
          phone: formattedPhone,
          telegram_id: telegram_id?.trim() || null,
          temporaryPassword: password
        }
      })
    }

    // -------------------------------------------------------------------------
    // 2. ASSIGN / CHANGE MEMBER ROLE (Super Admin ONLY)
    // -------------------------------------------------------------------------
    if (action === 'ASSIGN_ROLE') {
      if (!isCallerSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Only Super Admins can assign or modify member roles.' },
          { status: 403 }
        )
      }

      const { memberId, newRole } = body
      if (!memberId || !newRole) {
        return NextResponse.json({ error: 'Missing memberId or newRole' }, { status: 400 })
      }

      // Check target member
      const { data: targetUser, error: targetErr } = await supabaseAdmin.auth.admin.getUserById(memberId)
      if (targetErr || !targetUser.user) {
        return NextResponse.json({ error: 'Target member not found.' }, { status: 404 })
      }

      // Protect root Super Admin from demotion
      if (targetUser.user.email === ROOT_SUPER_ADMIN_EMAIL) {
        return NextResponse.json(
          { error: 'Security restriction: Primary Super Admin role cannot be modified.' },
          { status: 400 }
        )
      }

      const roleKey: 'super_admin' | 'admin' | 'warehouseman' | 'courier' =
        newRole === 'super_admin'
          ? 'super_admin'
          : newRole === 'warehouseman'
          ? 'warehouseman'
          : newRole === 'courier'
          ? 'courier'
          : 'admin'

      const dbRole = roleKey === 'courier' ? 'courier' : roleKey === 'warehouseman' ? 'warehouseman' : 'admin'

      // 1. Update user_metadata in auth.users
      await supabaseAdmin.auth.admin.updateUserById(memberId, {
        user_metadata: {
          ...targetUser.user.user_metadata,
          role: roleKey,
          is_super_admin: roleKey === 'super_admin'
        }
      })

      // 2. Update profiles table with fallback
      const { error: profileUpdateErr } = await supabaseAdmin
        .from('profiles')
        .update({ role: dbRole })
        .eq('id', memberId)

      if (profileUpdateErr && dbRole === 'warehouseman') {
        await supabaseAdmin
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', memberId)
      }

      // 3. If promoted to courier, ensure in crm_couriers roster
      if (roleKey === 'courier') {
        const phone = targetUser.user.user_metadata?.phone_number
        const name = targetUser.user.user_metadata?.name || targetUser.user.email?.split('@')[0]
        if (phone) {
          const { data: existingRoster } = await supabaseAdmin
            .from('crm_couriers')
            .select('id')
            .eq('phone_number', phone)
            .maybeSingle()

          if (!existingRoster) {
            await supabaseAdmin.from('crm_couriers').insert({
              name,
              phone_number: phone,
              is_active: true
            })
          }
        }
      }

      return NextResponse.json({
        ok: true,
        success: true,
        memberId,
        newRole: roleKey
      })
    }

    // -------------------------------------------------------------------------
    // 3. DELETE MEMBER (Super Admin ONLY)
    // -------------------------------------------------------------------------
    if (action === 'DELETE_MEMBER') {
      if (!isCallerSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Only Super Admins can remove team members from the system.' },
          { status: 403 }
        )
      }

      const { memberId } = body
      if (!memberId) {
        return NextResponse.json({ error: 'Missing memberId' }, { status: 400 })
      }

      // Prevent self-deletion
      if (memberId === user.id) {
        return NextResponse.json(
          { error: 'You cannot delete your own active administrator account.' },
          { status: 400 }
        )
      }

      // Check target member
      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(memberId)
      if (targetUser?.user?.email === ROOT_SUPER_ADMIN_EMAIL) {
        return NextResponse.json(
          { error: 'Security restriction: Primary Super Admin account cannot be deleted.' },
          { status: 400 }
        )
      }

      const targetPhone = targetUser?.user?.user_metadata?.phone_number

      // 1. Delete from Supabase Auth
      const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(memberId)
      if (delAuthErr) {
        return NextResponse.json({ error: delAuthErr.message }, { status: 400 })
      }

      // 2. Delete from profiles
      await supabaseAdmin.from('profiles').delete().eq('id', memberId)

      // 3. If courier, mark inactive in crm_couriers roster
      if (targetPhone) {
        await supabaseAdmin
          .from('crm_couriers')
          .update({ is_active: false })
          .eq('phone_number', targetPhone)
      }

      return NextResponse.json({
        ok: true,
        success: true,
        deletedMemberId: memberId
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[CRM Team API] POST error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
