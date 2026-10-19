import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { formatPhoneForStorage } from '@/lib/utils/phone'

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

    // 1. Determine active shift boundary from latest closeout
    let latestCloseout: any = null
    try {
      const { data: dbCo } = await supabaseAdmin
        .from('crm_day_closeouts')
        .select('shift_end, created_at')
        .order('shift_end', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (dbCo) latestCloseout = dbCo
    } catch (coErr) {}

    const shiftStartIso = latestCloseout
      ? (latestCloseout.shift_end || latestCloseout.created_at)
      : null

    let customerList: any[] = []
    let matchedCrmCourier: any = null

    // 2. Match active crm_orders assigned to this courier in the CRM roster
    try {
      const cleanUserPhone = (profile.phone_number || '').replace(/\D/g, '')
      const telegramId = user.user_metadata?.telegram_id

      const { data: crmCouriers } = await supabaseAdmin
        .from('crm_couriers')
        .select('id, name, phone_number, telegram_id')

      const userEmail = (user.email || '').toLowerCase()

      // 1. Primary Match: Direct Phone Match (deterministic)
      matchedCrmCourier = (crmCouriers || []).find(c => {
        const cClean = (c.phone_number || '').replace(/\D/g, '')
        return cleanUserPhone && cClean && (cleanUserPhone.endsWith(cClean.slice(-9)) || cClean.endsWith(cleanUserPhone.slice(-9)))
      })

      // 2. Secondary Match: Telegram ID
      if (!matchedCrmCourier && telegramId) {
        matchedCrmCourier = (crmCouriers || []).find(c => c.telegram_id && String(c.telegram_id) === String(telegramId))
      }

      // 3. Tertiary Match: Email alias with role guard
      if (!matchedCrmCourier && userEmail) {
        matchedCrmCourier = (crmCouriers || []).find(c => {
          const isWarehouse = c.name.includes('מחסנאי') || c.name.toLowerCase().includes('warehouse')
          if (profile.role === 'courier' && isWarehouse) return false

          return (
            (userEmail.includes('subi') && c.name.includes('שובי')) ||
            (userEmail.includes('sosoma') && isWarehouse) ||
            (userEmail.includes('soso') && !userEmail.includes('sosoma') && c.name.includes('סוסו') && !isWarehouse) ||
            (userEmail.includes('monkey') && c.name.toLowerCase().includes('monkey')) ||
            (userEmail.includes('mair') && c.name.toLowerCase().includes('mair')) ||
            (userEmail.includes('tofi') && c.name.toLowerCase().includes('tofi')) ||
            (userEmail.includes('zoan') && c.name.toLowerCase().includes('zoan')) ||
            (userEmail.includes('lola') && c.name.includes('לולה'))
          )
        })
      }

      if (matchedCrmCourier) {
        // Fetch all active unsettled crm_orders assigned to this courier
        const { data: activeOrders } = await supabaseAdmin
          .from('crm_orders')
          .select(`
            id,
            address,
            city,
            payment_method,
            is_prepaid,
            total_price,
            is_settled,
            order_date,
            created_at,
            crm_customers (
              id,
              address_name,
              phone_number
            )
          `)
          .eq('courier_id', matchedCrmCourier.id)
          .eq('is_settled', false)
          .order('created_at', { ascending: false })

        // Fetch all existing rows in customers table
        const { data: allCusts } = await supabaseAdmin
          .from('customers')
          .select('id, name, phone_number, is_active, is_completed, created_at, assigned_courier_id')

        const activeCustomerIds = new Set<string>()

        for (const order of activeOrders || []) {
          const cust = (order as any).crm_customers
          const orderPhone = cust?.phone_number
          const orderAddress = order.address || cust?.address_name || 'Delivery Address'
          if (!orderPhone) continue

          let paymentBadge: { text: string; type: string; amountToCollect: number } | undefined = undefined
          if (order.payment_method === 'ATM_CODE') {
            paymentBadge = { text: '🏧 שולם בקוד משיכה — 0₪ לגבייה', type: 'atm_code', amountToCollect: 0 }
          } else if (order.payment_method === 'BIT') {
            paymentBadge = { text: '📱 שולם בביט — 0₪ לגבייה', type: 'bit', amountToCollect: 0 }
          } else if (order.payment_method === 'CRYPTO') {
            paymentBadge = { text: '🪙 שולם בקריפטו — 0₪ לגבייה', type: 'crypto', amountToCollect: 0 }
          } else if (order.payment_method === 'CREDIT' || order.is_prepaid) {
            paymentBadge = { text: '💳 שולם מראש — 0₪ לגבייה', type: 'prepaid', amountToCollect: 0 }
          } else if (order.total_price !== undefined && order.total_price !== null) {
            paymentBadge = { text: `💵 לגבות מזומן: ₪${(order.total_price || 0).toLocaleString()}`, type: 'cash', amountToCollect: order.total_price || 0 }
          }

          const cleanOrderPhone = orderPhone.replace(/\D/g, '')
          let matchedCust = (allCusts || []).find(c => {
            const cClean = (c.phone_number || '').replace(/\D/g, '')
            return cleanOrderPhone && cClean && (cleanOrderPhone.endsWith(cClean.slice(-9)) || cClean.endsWith(cleanOrderPhone.slice(-9)))
          })

          if (matchedCust) {
            activeCustomerIds.add(matchedCust.id)
            if (matchedCust.assigned_courier_id !== user.id || !matchedCust.is_active || matchedCust.name !== orderAddress) {
              await supabaseAdmin
                .from('customers')
                .update({
                  assigned_courier_id: user.id,
                  name: orderAddress,
                  is_active: true
                })
                .eq('id', matchedCust.id)
              matchedCust.assigned_courier_id = user.id
              matchedCust.name = orderAddress
              matchedCust.is_active = true
            }

            customerList.push({
              id: matchedCust.id,
              name: matchedCust.name,
              is_active: matchedCust.is_active,
              is_completed: matchedCust.is_completed,
              created_at: matchedCust.created_at,
              assigned_courier_id: user.id,
              payment_badge: paymentBadge
            })
          } else {
            // Auto-provision into customers table for Twilio call-masking
            const { data: newCust, error: insErr } = await supabaseAdmin
              .from('customers')
              .insert({
                name: orderAddress,
                phone_number: formatPhoneForStorage(orderPhone),
                is_active: true,
                is_completed: false,
                assigned_courier_id: user.id
              })
              .select('id, name, is_active, is_completed, created_at, assigned_courier_id')
              .single()

            if (!insErr && newCust) {
              if (allCusts) allCusts.push(newCust as any)
              activeCustomerIds.add(newCust.id)
              customerList.push({
                ...newCust,
                payment_badge: paymentBadge
              })
            }
          }
        }

        // Deactivate any stale customers previously assigned to this courier that are NOT in active orders!
        const staleCusts = (allCusts || []).filter(c =>
          c.assigned_courier_id === user.id &&
          c.is_active &&
          !activeCustomerIds.has(c.id)
        )
        if (staleCusts.length > 0) {
          const staleIds = staleCusts.map(c => c.id)
          await supabaseAdmin
            .from('customers')
            .update({ is_active: false, assigned_courier_id: null })
            .in('id', staleIds)
        }
      }
    } catch (crmErr) {
      console.warn('[CourierAPI] Note on CRM order matching:', crmErr)
    }

    // Fallback if not matched to CRM courier: fetch assigned customers directly from legacy table for current shift only
    if (!matchedCrmCourier) {
      let legacyQuery = supabaseAdmin
        .from('customers')
        .select('id, name, is_active, is_completed, created_at, assigned_courier_id')
        .eq('is_active', true)
        .eq('assigned_courier_id', user.id)

      if (shiftStartIso) {
        legacyQuery = legacyQuery.gt('created_at', shiftStartIso)
      }

      const { data: legacyCustomers } = await legacyQuery.order('name', { ascending: true })
      customerList = legacyCustomers || []
    }

    // Deduplicate customerList by id
    const uniqueMap = new Map()
    for (const c of customerList) {
      uniqueMap.set(c.id, c)
    }
    customerList = Array.from(uniqueMap.values())

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
