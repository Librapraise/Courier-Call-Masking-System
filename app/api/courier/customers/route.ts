import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

    let user = null
    let authError = null

    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      )
      const result = await supabaseWithToken.auth.getUser()
      user = result.data.user
      authError = result.error
    } else {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll() {},
          },
        }
      )
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
    }

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Verify user is a courier
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, phone_number')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 401 }
      )
    }

    // Security check: Only couriers (or admins inspecting)
    if (profile.role !== 'courier' && profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Access restricted to couriers' },
        { status: 403 }
      )
    }

    // 1. Fetch customers assigned specifically to this courier ID
    const { data: assignedCustomers, error: queryErr } = await supabaseAdmin
      .from('customers')
      .select('id, name, is_active, is_completed, created_at, assigned_courier_id')
      .eq('is_active', true)
      .eq('assigned_courier_id', user.id)
      .order('name', { ascending: true })

    if (queryErr) {
      console.error('[CourierAPI] Error fetching assigned customers:', queryErr)
      return NextResponse.json(
        { error: 'Database query failed' },
        { status: 500 }
      )
    }

    let customerList = assignedCustomers || []

    // 2. Also check if courier is mapped to a crm_couriers roster record (by phone or telegram)
    try {
      const cleanUserPhone = (profile.phone_number || '').replace(/\D/g, '')
      const telegramId = user.user_metadata?.telegram_id

      const { data: crmCouriers } = await supabaseAdmin
        .from('crm_couriers')
        .select('id, phone_number, telegram_id')

      const matchedCrmCourier = (crmCouriers || []).find(c => {
        const cClean = (c.phone_number || '').replace(/\D/g, '')
        const matchPhone = cleanUserPhone && cClean && (cleanUserPhone.endsWith(cClean.slice(-9)) || cClean.endsWith(cleanUserPhone.slice(-9)))
        const matchTelegram = telegramId && String(c.telegram_id) === String(telegramId)
        return matchPhone || matchTelegram
      })

      if (matchedCrmCourier) {
        // Fetch active crm_orders for this courier
        const { data: activeOrders } = await supabaseAdmin
          .from('crm_orders')
          .select('id, address, crm_customers(phone_number)')
          .eq('courier_id', matchedCrmCourier.id)
          .eq('is_settled', false)

        if (activeOrders && activeOrders.length > 0) {
          const orderPhones = activeOrders.map((o: any) => (o.crm_customers?.phone_number || '').replace(/\D/g, '')).filter(Boolean)
          
          const { data: allActiveCusts } = await supabaseAdmin
            .from('customers')
            .select('id, name, phone_number, is_active, is_completed, created_at, assigned_courier_id')
            .eq('is_active', true)

          const matchedByOrder = (allActiveCusts || []).filter(c => {
            const cClean = (c.phone_number || '').replace(/\D/g, '')
            return orderPhones.some(p => cClean.endsWith(p.slice(-9)) || p.endsWith(cClean.slice(-9)))
          })

          customerList = Array.from(
            new Map([...customerList, ...matchedByOrder].map(c => [c.id, c])).values()
          )
        }
      }
    } catch (crmErr) {
      console.warn('[CourierAPI] Note on CRM order matching:', crmErr)
    }

    // Return the customer list (Notice: phone_number is never exposed to client)
    return NextResponse.json({
      courierId: user.id,
      customers: customerList,
    })
  } catch (err: any) {
    console.error('[CourierAPI] Unexpected error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
