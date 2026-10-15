import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { supabaseAdmin, createClient } from '@/lib/supabase/server'
import { BRANDS_LIST } from '@/lib/crm/catalog-data'
import { sendTelegramMessage } from '@/lib/crm/telegram-bot'
import { formatPhoneForStorage } from '@/lib/utils/phone'
import { isStaffUser } from '@/lib/auth/roles'
import { getIsraelDateString, getIsraelMidnightIso } from '@/lib/crm/date-utils'
import { parseDeliveryMessage, getOrderPaymentInfo } from '@/lib/crm/parser'

function getLocalDayCloseouts(): any[] {
  try {
    const filePath = path.join(process.cwd(), 'data', 'crm_day_closeouts.json')
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content) || []
    }
  } catch (e) {}
  return []
}

function saveLocalDayCloseout(record: any) {
  try {
    const dirPath = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    const filePath = path.join(dirPath, 'crm_day_closeouts.json')
    const existing = getLocalDayCloseouts()
    const updated = [record, ...existing.filter((x: any) => x.id !== record.id)].slice(0, 50)
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8')
  } catch (e) {}
}

export async function GET() {
  try {
    // 0. Verify Auth Session & Admin Privilege
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Persian Team Management requires an active manager session.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isStaffUser(user, profile)) {
      return NextResponse.json({ error: 'Forbidden: Admin, Super Admin, or Warehouseman privileges required.' }, { status: 403 })
    }
    // 1. Fetch Orders with Customer, Brand, and Courier relationships
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('crm_orders')
      .select(`
        id,
        address,
        city,
        menu_items,
        actual_items,
        total_price,
        is_settled,
        order_date,
        raw_message,
        customer_id,
        brand_id,
        courier_id,
        crm_customers:customer_id (
          id,
          address_name,
          phone_number,
          telegram_handle,
          customer_type,
          total_orders,
          total_spent
        ),
        brands:brand_id (
          id,
          name
        ),
        crm_couriers:courier_id (
          id,
          name,
          phone_number
        )
      `)
      .order('order_date', { ascending: false })
      .limit(200)

    if (ordersError) {
      console.warn('[CRM API] Orders query fallback:', ordersError.message)
    }

    // 2. Fetch all Brands
    const { data: brandsData } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .order('name')

    const brands = brandsData && brandsData.length > 0
      ? brandsData
      : BRANDS_LIST.map((name, i) => ({ id: `brand-${i}`, name }))

    // 3. Fetch live Products Inventory
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('category')

    // 4. Fetch Couriers (with auto-sync from profiles roster)
    let { data: couriersData } = await supabaseAdmin
      .from('crm_couriers')
      .select('*')
      .order('name')

    // Safeguard: Ensure any courier account in profiles is automatically synced into crm_couriers roster
    try {
      const { data: courierProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, phone_number')
        .eq('role', 'courier')

      if (courierProfiles && courierProfiles.length > 0) {
        const existingPhones = new Set(
          (couriersData || []).map(c => (c.phone_number || '').replace(/\D/g, '').slice(-9))
        )
        const missing = courierProfiles.filter(p => {
          const cleanP = (p.phone_number || '').replace(/\D/g, '').slice(-9)
          return cleanP && !existingPhones.has(cleanP)
        })

        if (missing.length > 0) {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
          const authMap = new Map((authUsers?.users || []).map(u => [u.id, u]))

          for (const m of missing) {
            const u = authMap.get(m.id)
            const meta = u ? u.user_metadata : {}
            const name = meta.name || meta.full_name || (m.email ? m.email.split('@')[0] : 'Courier')
            const telegramId = meta.telegram_id ? Number(meta.telegram_id) : null

            await supabaseAdmin.from('crm_couriers').insert({
              name,
              phone_number: m.phone_number,
              telegram_id: telegramId,
              is_active: true
            })
          }

          const { data: refreshedCouriers } = await supabaseAdmin
            .from('crm_couriers')
            .select('*')
            .order('name')
          if (refreshedCouriers) {
            couriersData = refreshedCouriers
          }
        }
      }
    } catch (syncErr) {
      console.warn('[CRM Dashboard API] Courier auto-sync warning:', syncErr)
    }

    // 5. Query latest Day Closeout to determine active shift
    let recentDayCloseouts: any[] = []
    let latestDayCloseout: any = null
    try {
      const { data: dbCloseouts } = await supabaseAdmin
        .from('crm_day_closeouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      if (dbCloseouts && dbCloseouts.length > 0) {
        recentDayCloseouts = dbCloseouts
        latestDayCloseout = dbCloseouts[0]
      }
    } catch (coErr) {}

    if (recentDayCloseouts.length === 0) {
      const localCo = getLocalDayCloseouts()
      if (localCo.length > 0) {
        recentDayCloseouts = localCo
        latestDayCloseout = localCo[0]
      }
    }

    const defaultShiftStart = getIsraelMidnightIso()

    const isRecentCloseout = latestDayCloseout && (new Date().getTime() - new Date(latestDayCloseout.created_at).getTime() < 36 * 3600 * 1000)
    const shiftStartIso = isRecentCloseout
      ? (latestDayCloseout.shift_end || latestDayCloseout.created_at)
      : defaultShiftStart

    const allOrders = orders || []
    const todayOrders = isRecentCloseout
      ? allOrders.filter(o => o.order_date > shiftStartIso)
      : allOrders.filter(o => o.order_date >= defaultShiftStart)
    const totalDeliveriesToday = todayOrders.length
    
    // Courier physical cash currently in the street/courier hands (UNSETTLED only, excluding Bit/prepaid)
    const courierCashToday = todayOrders
      .filter(o => !o.is_settled && !getOrderPaymentInfo(o).isPrepaid)
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
    
    // Total gross volume across all deliveries today (both settled and pending, cash + bit)
    const totalCashToday = todayOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)

    // Total amount in Bit / credit provider today (prepaid)
    const totalBitCreditToday = todayOrders
      .filter(o => getOrderPaymentInfo(o).isPrepaid)
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
    
    // Reconciled physical cash already handed over to the warehouse today
    const reconciledCashToday = todayOrders
      .filter(o => o.is_settled && !getOrderPaymentInfo(o).isPrepaid)
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)

    // Active customers count and directory
    const { data: customersData, count: customerCount } = await supabaseAdmin
      .from('crm_customers')
      .select('*, brands:last_brand_id(name)')
      .order('created_at', { ascending: false })

    // Low stock count (stock_on_hand <= 10.0 or min_stock_alert)
    const lowStockCount = (products || []).filter(p => Number(p.stock_on_hand) <= (Number(p.min_stock_alert) || 10.0)).length

    // Extract unique active cities with counts
    const cityCounts: Record<string, number> = {}
    allOrders.forEach(o => {
      const c = (o.city || 'אחר').trim()
      cityCounts[c] = (cityCounts[c] || 0) + 1
    })

    // Also populate primary Israeli delivery hubs so dispatchers always have the operational cities available
    const PRIMARY_ISRAELI_CITIES = [
      'תל אביב',
      'פתח תקווה',
      'ראשון לציון',
      'רמת גן',
      'חולון',
      'בת ים',
      'גבעתיים',
      'הרצליה',
      'נתניה',
      'כפר סבא',
      'רעננה',
      'הוד השרון',
      'אשדוד',
      'אשקלון',
      'באר שבע',
      'רחובות',
      'נס ציונה',
      'יבנה',
      'מודיעין',
      'לוד',
      'רמלה',
      'ירושלים',
      'חיפה',
      'חדרה',
      'בני עייש'
    ]

    PRIMARY_ISRAELI_CITIES.forEach(city => {
      if (cityCounts[city] === undefined) {
        cityCounts[city] = 0
      }
    })

    // Compute courier totals separating unsettled (pending closeout) from already-settled
    // and separating physical cash to collect from Bit/credit prepaid funds
    const courierSummaryMap: Record<string, {
      totalCashToday: number
      totalBitToday: number
      totalGrossToday: number
      totalOrdersToday: number
      settledCashToday: number
      settledBitToday: number
      settledOrdersToday: number
      pendingCashToday: number
      pendingBitToday: number
      pendingOrdersToday: number
    }> = {}

    todayOrders.forEach(o => {
      const cId = (o as any).crm_couriers?.id || (o as any).courier_id || 'unknown'
      if (!courierSummaryMap[cId]) {
        courierSummaryMap[cId] = {
          totalCashToday: 0,
          totalBitToday: 0,
          totalGrossToday: 0,
          totalOrdersToday: 0,
          settledCashToday: 0,
          settledBitToday: 0,
          settledOrdersToday: 0,
          pendingCashToday: 0,
          pendingBitToday: 0,
          pendingOrdersToday: 0
        }
      }
      const price = Number(o.total_price) || 0
      const payInfo = getOrderPaymentInfo(o)
      const physicalCash = payInfo.isPrepaid ? 0 : price
      const bitAmount = payInfo.isPrepaid ? price : 0

      courierSummaryMap[cId].totalOrdersToday += 1
      courierSummaryMap[cId].totalGrossToday += price
      courierSummaryMap[cId].totalCashToday += physicalCash
      courierSummaryMap[cId].totalBitToday += bitAmount

      if (o.is_settled) {
        courierSummaryMap[cId].settledOrdersToday += 1
        courierSummaryMap[cId].settledCashToday += physicalCash
        courierSummaryMap[cId].settledBitToday += bitAmount
      } else {
        courierSummaryMap[cId].pendingOrdersToday += 1
        courierSummaryMap[cId].pendingCashToday += physicalCash
        courierSummaryMap[cId].pendingBitToday += bitAmount
      }
    })

    // Fetch today's cash settlements to compute exact net handed to warehouseman per courier
    const { data: todaySettlements } = await supabaseAdmin
      .from('cash_settlements')
      .select('courier_id, amount_received, net_expected, gross_collected')
      .gte('created_at', shiftStartIso)
      .eq('status', 'SETTLED')

    const courierSettledNetMap: Record<string, number> = {}
    ;(todaySettlements || []).forEach(s => {
      const cId = s.courier_id
      if (cId) {
        const net = Number(s.amount_received ?? s.net_expected ?? 0)
        courierSettledNetMap[cId] = (courierSettledNetMap[cId] || 0) + net
      }
    })

    const couriers = (couriersData || []).map(c => {
      const s = courierSummaryMap[c.id] || {
        totalCashToday: 0,
        totalBitToday: 0,
        totalGrossToday: 0,
        totalOrdersToday: 0,
        settledCashToday: 0,
        settledBitToday: 0,
        settledOrdersToday: 0,
        pendingCashToday: 0,
        pendingBitToday: 0,
        pendingOrdersToday: 0
      }
      const hasOrdersToday = s.totalOrdersToday > 0
      const hasPending = s.pendingOrdersToday > 0
      const isSettledToday = hasOrdersToday && !hasPending

      return {
        ...c,
        // todayCash & todayOrders represent the active pending batch waiting for closeout!
        todayCash: s.pendingCashToday,
        todayBit: s.pendingBitToday,
        todayOrders: s.pendingOrdersToday,
        totalOrdersToday: s.totalOrdersToday,
        totalCashToday: s.totalCashToday,
        totalBitToday: s.totalBitToday,
        totalGrossToday: s.totalGrossToday,
        settledOrdersToday: s.settledOrdersToday,
        settledCashToday: s.settledCashToday,
        settledBitToday: s.settledBitToday,
        settledNetCashToday: courierSettledNetMap[c.id] || 0,
        pendingOrdersToday: s.pendingOrdersToday,
        pendingCashToday: s.pendingCashToday,
        pendingBitToday: s.pendingBitToday,
        isSettledToday,
        shiftStatus: !hasOrdersToday ? 'no_shift' : hasPending ? 'open' : 'reconciled'
      }
    })

    // Recent cash settlements (for live warehouse collection feed & alerts)
    const { data: recentSettlements } = await supabaseAdmin
      .from('cash_settlements')
      .select('id, courier_id, settlement_date, gross_collected, courier_pay, bonus_amount, net_expected, amount_received, status, notes, created_at, crm_couriers(name, phone_number, telegram_id)')
      .order('created_at', { ascending: false })
      .limit(15)

    return NextResponse.json({
      metrics: {
        courierCashToday,
        totalBitCreditToday,
        totalCashToday,
        reconciledCashToday,
        totalDeliveriesToday,
        activeCustomers: customerCount || allOrders.length,
        lowStockAlerts: lowStockCount
      },
      orders: allOrders,
      brands,
      products: products || [],
      couriers,
      customers: customersData || [],
      cityCounts,
      recentSettlements: recentSettlements || [],
      recentDayCloseouts: recentDayCloseouts || [],
      latestDayCloseout: latestDayCloseout || null,
      shiftStartTime: shiftStartIso
    })
  } catch (err: any) {
    console.error('[CRM API] Unexpected error in GET:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // 0. Verify Auth Session & Admin Privilege
    const authHeader = req.headers.get('authorization')
    const isServiceAuth = authHeader && process.env.SUPABASE_SERVICE_ROLE_KEY && authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`

    let user: any = null

    if (!isServiceAuth) {
      let supabase
      try {
        supabase = await createClient()
      } catch (e: any) {
        return NextResponse.json({ error: 'Unauthorized: Session context missing.' }, { status: 401 })
      }
      const authRes = await supabase.auth.getUser()
      user = authRes.data?.user
      const authError = authRes.error

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 })
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!isStaffUser(user, profile)) {
        return NextResponse.json({ error: 'Forbidden: Admin, Super Admin, or Warehouseman privileges required.' }, { status: 403 })
      }
    } else {
      user = {
        id: 'system-service',
        email: 'system@crm.internal',
        user_metadata: { name: 'מערכת / מנהל אוטומטי' }
      }
    }

    const body = await req.json()
    const { action } = body

    if (action === 'ADJUST_STOCK') {
      const { productId, adjustmentQuantity, reason } = body
      if (!productId || typeof adjustmentQuantity !== 'number') {
        return NextResponse.json({ error: 'Missing productId or adjustmentQuantity' }, { status: 400 })
      }

      // 1. Fetch current product
      const { data: prod, error: fetchErr } = await supabaseAdmin
        .from('products')
        .select('stock_on_hand, name')
        .eq('id', productId)
        .single()

      if (fetchErr || !prod) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      const newStock = Math.max(0, Number(prod.stock_on_hand) + adjustmentQuantity)

      // 2. Update stock
      await supabaseAdmin
        .from('products')
        .update({ stock_on_hand: newStock, updated_at: new Date().toISOString() })
        .eq('id', productId)

      // 3. Log transaction
      await supabaseAdmin
        .from('inventory_transactions')
        .insert({
          product_id: productId,
          quantity: adjustmentQuantity,
          reason: reason || 'MANUAL_ADJUSTMENT',
          notes: `Dashboard manual adjustment for ${prod.name}`
        })

      return NextResponse.json({ success: true, newStock })
    }

    if (action === 'ASSIGN_ORDER_COURIER') {
      const { orderId, courierId } = body
      if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
      }

      // 1. Update order in crm_orders and select full details
      const { data: updatedOrder, error: updateErr } = await supabaseAdmin
        .from('crm_orders')
        .update({ courier_id: courierId || null })
        .eq('id', orderId)
        .select(`
          id,
          address,
          city,
          menu_items,
          actual_items,
          total_price,
          courier_id,
          crm_customers (
            id,
            address_name,
            phone_number
          ),
          crm_couriers:courier_id (
            id,
            name,
            phone_number,
            telegram_id
          )
        `)
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }

      const assignedCourier = (updatedOrder as any)?.crm_couriers
      const custPhone = (updatedOrder as any)?.crm_customers?.phone_number

      // 2. Synchronize to legacy customers table for the /courier mobile portal
      if (custPhone) {
        const cleanCustPhone = custPhone.replace(/\D/g, '')
        const { data: legacyCusts } = await supabaseAdmin
          .from('customers')
          .select('id, phone_number')

        const matchedCust = (legacyCusts || []).find(c => {
          const cClean = (c.phone_number || '').replace(/\D/g, '')
          return cClean && (cClean.endsWith(cleanCustPhone.slice(-9)) || cleanCustPhone.endsWith(cClean.slice(-9)))
        })

        let targetProfileId: string | null = null

        if (assignedCourier) {
          const cleanCourierPhone = (assignedCourier.phone_number || '').replace(/\D/g, '')
          const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, phone_number, role')
            .eq('role', 'courier')

          const matchedProfile = (profiles || []).find(p => {
            const pClean = (p.phone_number || '').replace(/\D/g, '')
            return pClean && cleanCourierPhone && (pClean.endsWith(cleanCourierPhone.slice(-9)) || cleanCourierPhone.endsWith(pClean.slice(-9)))
          })

          targetProfileId = matchedProfile ? matchedProfile.id : (profiles?.[0]?.id || null)
        }

        if (matchedCust) {
          await supabaseAdmin
            .from('customers')
            .update({ 
              assigned_courier_id: targetProfileId,
              name: updatedOrder.address,
              is_active: true,
              is_completed: false
            })
            .eq('id', matchedCust.id)
        } else {
          await supabaseAdmin
            .from('customers')
            .insert({
              name: updatedOrder.address,
              phone_number: formatPhoneForStorage(custPhone),
              is_active: true,
              is_completed: false,
              assigned_courier_id: targetProfileId
            })
        }
      }

      // 3. Send instant Telegram dispatch notification to the courier
      if (assignedCourier?.telegram_id) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (botToken) {
          try {
            const payInfo = getOrderPaymentInfo(updatedOrder)
            const priceDisplay = payInfo.isPrepaid
              ? 'שולם מראש (0₪ מזומן) 💳'
              : `₪${Number(updatedOrder.total_price || 0).toLocaleString()} מזומן`

            const prepaidWarning = payInfo.isPrepaid
              ? `\n💳 *סטטוס תשלום:* ${payInfo.labelHe} — *אין לגבות מזומן מהלקוח!*`
              : ''

            const dispatchAlert = `🛵 *הזמנה חדשה שובצה עבורך!*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${updatedOrder.address}
🏙️ *עיר:* ${updatedOrder.city || 'מרכז'}
💵 *סכום לגבייה:* ${priceDisplay}${prepaidWarning}
📦 *פריטים:* ${updatedOrder.menu_items || updatedOrder.actual_items || '—'}`

            await sendTelegramMessage(botToken, {
              chat_id: assignedCourier.telegram_id,
              parse_mode: 'Markdown',
              text: dispatchAlert
            })
          } catch (teleErr) {
            console.warn('[CRM API] Telegram dispatch alert error:', teleErr)
          }
        }
      }

      return NextResponse.json({ success: true, order: updatedOrder })
    }

    if (action === 'SETTLE_COURIER') {
      const {
        courierId,
        grossCollected,
        bonusAmount,
        notes,
        batYamCount: reqBatYamCount,
        standardCount: reqStandardCount,
        deliveryFees: reqDeliveryFees
      } = body
      if (!courierId) {
        return NextResponse.json({ error: 'Missing courierId' }, { status: 400 })
      }
      if (typeof grossCollected !== 'number' || grossCollected < 0) {
        return NextResponse.json({ error: 'grossCollected must be a non-negative number' }, { status: 400 })
      }

      const bonus = Math.max(0, Number(bonusAmount) || 0)

      // Determine active shift start for this courier
      let shiftStartIso = getIsraelMidnightIso()
      try {
        const { data: latestCloseout } = await supabaseAdmin
          .from('crm_day_closeouts')
          .select('shift_end, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (latestCloseout && (Date.now() - new Date(latestCloseout.created_at).getTime() < 36 * 3600 * 1000)) {
          shiftStartIso = latestCloseout.shift_end || latestCloseout.created_at
        }
      } catch (e) {}

      const { data: ordersToSettle } = await supabaseAdmin
        .from('crm_orders')
        .select(`
          id,
          total_price,
          city,
          address,
          raw_message,
          crm_customers:customer_id (
            address_name,
            city
          )
        `)
        .eq('courier_id', courierId)
        .gt('order_date', shiftStartIso)
        .eq('is_settled', false)

      const orders = ordersToSettle || []

      if (orders.length === 0) {
        return NextResponse.json({
          error: 'אין משלוחים פתוחים לסגירה עבור שליח זה היום (כל המשלוחים שבוצעו כבר נסגרו).'
        }, { status: 400 })
      }

      // Query previously settled orders in this shift for this courier to detect incremental multi-runs
      const { data: earlierSettledOrders } = await supabaseAdmin
        .from('crm_orders')
        .select('id, total_price')
        .eq('courier_id', courierId)
        .gt('order_date', shiftStartIso)
        .eq('is_settled', true)

      const earlierCount = earlierSettledOrders?.length || 0
      const earlierSettledTotal = (earlierSettledOrders || []).reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
      const isAdditionalRun = earlierCount > 0

      // Query actual net cash previously received by warehouse from this courier in this shift
      const todayDateStr = getIsraelDateString()
      const { data: earlierSettlements } = await supabaseAdmin
        .from('cash_settlements')
        .select('amount_received, net_expected, gross_collected')
        .eq('courier_id', courierId)
        .eq('status', 'SETTLED')
        .or(`settlement_date.eq.${todayDateStr},created_at.gte.${shiftStartIso}`)

      const earlierNetToWarehouse = (earlierSettlements || []).reduce(
        (sum, s) => sum + (Number(s.amount_received ?? s.net_expected ?? 0)),
        0
      )
      const displayEarlierNet = earlierNetToWarehouse > 0 ? earlierNetToWarehouse : earlierSettledTotal

      // Bat Yam = ₪50/delivery, all others = ₪100/delivery
      const BAT_YAM_FEE = 50
      const STANDARD_FEE = 100

      let batYamCount = 0
      let standardCount = 0

      // If client explicitly passed validated batYamCount, honor it directly
      if (typeof reqBatYamCount === 'number' && reqBatYamCount >= 0) {
        batYamCount = Math.min(reqBatYamCount, orders.length)
        standardCount = Math.max(0, orders.length - batYamCount)
      } else {
        for (const o of orders) {
          const combined = [
            o.city || '',
            o.address || '',
            (o as any).crm_customers?.city || '',
            (o as any).crm_customers?.address_name || '',
            (o as any).raw_message || ''
          ].join(' ').toLowerCase()

          const isBatYam =
            combined.includes('בת ים') ||
            combined.includes('בת-ים') ||
            combined.includes('בתים') ||
            combined.includes('יוספטל') ||
            combined.includes('יוסף טל') ||
            combined.includes('בלפור') ||
            combined.includes('הקוממיות') ||
            combined.includes('bat yam') ||
            combined.includes('bat-yam') ||
            combined.includes('batyam') ||
            combined.includes('yoseftal')

          if (isBatYam) batYamCount++
          else standardCount++
        }
      }

      let batchBitTotal = 0
      let batchPhysicalCash = 0
      for (const o of orders) {
        const payInfo = getOrderPaymentInfo(o)
        const p = Number(o.total_price) || 0
        if (payInfo.isPrepaid) {
          batchBitTotal += p
        } else {
          batchPhysicalCash += p
        }
      }

      const deliveryFees = typeof reqDeliveryFees === 'number' && reqDeliveryFees >= 0
        ? reqDeliveryFees
        : (batYamCount * BAT_YAM_FEE + standardCount * STANDARD_FEE)
      const courierPay  = deliveryFees + bonus
      const netToWarehouse = Math.max(0, grossCollected - courierPay)
      const totalOrderValue = orders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)

      // Mark only this unsettled batch as settled
      await supabaseAdmin
        .from('crm_orders')
        .update({ is_settled: true })
        .eq('courier_id', courierId)
        .gt('order_date', shiftStartIso)
        .eq('is_settled', false)

      // Record the full financial breakdown in cash_settlements
      const batYamBreakdown = batYamCount > 0 ? ` (${standardCount} רגיל ₪${standardCount * STANDARD_FEE} + ${batYamCount} בת ים ₪${batYamCount * BAT_YAM_FEE})` : ''
      const bitNoteStr = batchBitTotal > 0 ? ` [ביט/אשראי: ₪${batchBitTotal.toLocaleString()}]` : ''
      const settlementNotes = notes || (
        isAdditionalRun
          ? `סגירת קופה (סבב נוסף) — ${orders.length} משלוחים${batYamBreakdown}${bitNoteStr} בסבב זה | נגבה: ₪${grossCollected} | עמלת שליח: ₪${courierPay} (בונוס: ₪${bonus}) | נטו למחסנאי: ₪${netToWarehouse} (נסגרו מוקדם יותר: ${earlierCount} משלוחים / נטו ₪${displayEarlierNet.toLocaleString()})`
          : `סגירת קופה — ${orders.length} משלוחים${batYamBreakdown}${bitNoteStr} | נגבה: ₪${grossCollected} | עמלת שליח: ₪${courierPay} (בונוס: ₪${bonus}) | נטו למחסנאי: ₪${netToWarehouse}`
      )

      const { error: insertV2Error } = await supabaseAdmin
        .from('cash_settlements')
        .insert({
          courier_id:      courierId,
          total_collected: totalOrderValue,
          gross_collected: grossCollected,
          courier_pay:     courierPay,
          bonus_amount:    bonus,
          net_expected:    netToWarehouse,
          amount_received: netToWarehouse,
          status:          'SETTLED',
          notes:           settlementNotes
        })

      if (insertV2Error) {
        // Graceful fallback for legacy table schema before migration_settlement_v2.sql is applied
        console.warn('[CRM API] cash_settlements V2 columns not yet present, using base schema:', insertV2Error.message)
        await supabaseAdmin
          .from('cash_settlements')
          .insert({
            courier_id:      courierId,
            total_collected: totalOrderValue,
            amount_received: netToWarehouse,
            status:          'SETTLED',
            notes:           settlementNotes
          })
      }

      // ── Fetch courier details for Telegram ──────────────────────────────────
      const { data: courierRow } = await supabaseAdmin
        .from('crm_couriers')
        .select('name, telegram_id')
        .eq('id', courierId)
        .single()

      const courierName    = courierRow?.name || 'שליח'
      const courierTgId    = courierRow?.telegram_id
      const botToken       = process.env.TELEGRAM_BOT_TOKEN || ''
      const adminIdsEnv    = process.env.ALLOWED_TELEGRAM_ADMIN_IDS || ''
      const adminIds       = adminIdsEnv.split(',').map(s => s.trim()).filter(Boolean)

      // ── Resolve Warehouse Workers (Storekeepers) Dynamically from Database ──
      const warehouseTelegramIds = new Set<string>()

      try {
        // 1. Check env-configured warehouse IDs if specified
        const warehouseEnv = (process.env.WAREHOUSE_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
        warehouseEnv.forEach(id => warehouseTelegramIds.add(id))

        // 2. Fetch profiles with role 'warehouseman'
        const { data: warehouseProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, phone_number, role')
          .eq('role', 'warehouseman')

        // 3. Fetch crm_couriers roster to match phone numbers with registered telegram_ids (e.g. soso)
        const { data: crmRoster } = await supabaseAdmin
          .from('crm_couriers')
          .select('phone_number, telegram_id, name')

        // 4. Fetch Supabase Auth users to check user_metadata.telegram_id
        const { data: authUsersList } = await supabaseAdmin.auth.admin.listUsers()

        for (const u of authUsersList?.users || []) {
          const metaRole = u.user_metadata?.role
          const metaTg = u.user_metadata?.telegram_id
          if (metaRole === 'warehouseman' && metaTg) {
            warehouseTelegramIds.add(String(metaTg).trim())
          }
        }

        // Match warehouse profile phones or IDs with auth & crm_couriers roster
        for (const wp of warehouseProfiles || []) {
          const cleanPhone = (wp.phone_number || '').replace(/\D/g, '')
          if (cleanPhone) {
            const matched = (crmRoster || []).find(r => {
              const rClean = (r.phone_number || '').replace(/\D/g, '')
              return rClean && (cleanPhone.endsWith(rClean.slice(-9)) || rClean.endsWith(cleanPhone.slice(-9)))
            })
            if (matched?.telegram_id) {
              warehouseTelegramIds.add(String(matched.telegram_id).trim())
            }
          }
          const authMatch = (authUsersList?.users || []).find(u => u.id === wp.id)
          if (authMatch?.user_metadata?.telegram_id) {
            warehouseTelegramIds.add(String(authMatch.user_metadata.telegram_id).trim())
          }
        }
      } catch (lookupErr) {
        console.warn('[CRM API] Error querying warehouse workers for Telegram receipt:', lookupErr)
      }

      // Safeguard: The courier being settled must NEVER receive the storekeeper's collection alert
      if (courierTgId) {
        warehouseTelegramIds.delete(String(courierTgId).trim())
      }

      // ── Message to COURIER ──────────────────────────────────────────────────
      const courierMsg =
        `💵 *סגירת משמרת — ${courierName}*${isAdditionalRun ? ` *(סבב נוסף)*` : ''}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        (isAdditionalRun ? `ℹ️ _סבב סגירה נוסף להיום (${earlierCount} משלוחים נסגרו והועברו מוקדם יותר)_\n` : '') +
        `📦 *משלוחים שבוצעו בסבב זה:* ${orders.length}\n` +
        (standardCount > 0 ? `  • ${standardCount} משלוחים רגילים × ₪${STANDARD_FEE} = ₪${standardCount * STANDARD_FEE}\n` : '') +
        (batYamCount   > 0 ? `  • ${batYamCount} משלוחי בת ים × ₪${BAT_YAM_FEE} = ₪${batYamCount * BAT_YAM_FEE}\n` : '') +
        (bonus         > 0 ? `  • 🎁 בונוס: ₪${bonus}\n` : '') +
        `\n💰 *גבית מלקוחות במזומן:* ₪${grossCollected.toLocaleString()}\n` +
        (batchBitTotal > 0 ? `💳 *שולם מראש (ביט/אשראי):* ₪${batchBitTotal.toLocaleString()} _(לא נגבה במזומן)_\n` : '') +
        `📊 *עמלתך בסבב זה:* ₪${courierPay.toLocaleString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💳 *עליך להעביר למחסנאי במזומן: ₪${netToWarehouse.toLocaleString()}*`

      if (courierTgId && botToken) {
        await sendTelegramMessage(botToken, {
          chat_id:    courierTgId,
          text:       courierMsg,
          parse_mode: 'Markdown'
        })
      }

      // ── Message to WAREHOUSEMAN / STOREKEEPER (Actionable Collection Alert) ──
      const warehouseMsg =
        `🔔 *התראה למחסנאי — דרישת גביית מזומן משליח!*${isAdditionalRun ? ` *(סבב נוסף)*` : ''}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛵 *שליח:* *${courierName}*\n` +
        `📦 *משלוחים שחולקו בסבב זה:* ${orders.length}\n` +
        `💰 *סך שנגבה מלקוחות במזומן:* ₪${grossCollected.toLocaleString()}\n` +
        (batchBitTotal > 0 ? `💳 *מתוכם שולם בביט / אשראי:* ₪${batchBitTotal.toLocaleString()} _(אצל ספק האשראי, לא אצל השליח)_\n` : '') +
        `📊 *עמלת השליח שנוכתה:* ₪${courierPay.toLocaleString()}` + (bonus > 0 ? ` (כולל בונוס ₪${bonus})` : '') + `\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💵 *עליך לגבות כעת מ${courierName}: ₪${netToWarehouse.toLocaleString()} במזומן!*` +
        (isAdditionalRun ? `\n\nℹ️ _הערה: ${earlierCount} משלוחים קודמים (נטו ₪${displayEarlierNet.toLocaleString()}) כבר הועברו מוקדם יותר היום._` : '')

      // ── Message to WAREHOUSE WORKERS ONLY (Storekeeper Physical Collection) ─
      // NOTE: The accountant / dispatchers must NOT receive this collection message.
      // Only the warehouse worker physically collects cash envelopes from couriers.
      let warehouseNotifiedCount = 0
      if (botToken) {
        if (warehouseTelegramIds.size === 0) {
          console.warn('[CRM API] Warning: No warehouse worker configured with a Telegram ID to receive cash collection alert.')
        } else {
          for (const whId of warehouseTelegramIds) {
            try {
              const ok = await sendTelegramMessage(botToken, {
                chat_id:    whId,
                text:       warehouseMsg,
                parse_mode: 'Markdown'
              })
              if (ok) {
                warehouseNotifiedCount++
                console.log(`[CRM API] Successfully sent collection alert to warehouse worker ID: ${whId}`)
              }
            } catch (whErr) {
              console.warn(`[CRM API] Non-fatal error sending collection alert to warehouse worker ID ${whId}:`, whErr)
            }
          }
        }
      }

      return NextResponse.json({
        success:                true,
        settledOrders:          orders.length,
        grossCollected,
        courierPay,
        bonus,
        netToWarehouse,
        batYamCount,
        standardCount,
        deliveryFees,
        warehouseNotifiedCount,
        warehouseRecipients:    Array.from(warehouseTelegramIds)
      })
    }

    // ========================================================
    // END-OF-DAY SHIFT CLOSEOUT & Z-REPORT (CLOSE_DAY)
    // ========================================================
    if (action === 'CLOSE_DAY') {
      const { notes } = body

      // 1. Determine active shift start
      let latestCloseout: any = null
      try {
        const { data: dbCo } = await supabaseAdmin
          .from('crm_day_closeouts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (dbCo) latestCloseout = dbCo
      } catch (coErr) {}

      if (!latestCloseout) {
        const localCo = getLocalDayCloseouts()
        if (localCo.length > 0) latestCloseout = localCo[0]
      }

      const defaultShiftStart = getIsraelMidnightIso()
      const isCloseoutRecent = latestCloseout && (new Date().getTime() - new Date(latestCloseout.created_at).getTime() < 36 * 3600 * 1000)
      const shiftStart = isCloseoutRecent
        ? (latestCloseout.shift_end || latestCloseout.created_at)
        : defaultShiftStart

      const shiftEnd = new Date().toISOString()

      // 2. Fetch all orders belonging to this active shift
      const query = supabaseAdmin
        .from('crm_orders')
        .select(`
          id, total_price, courier_id, city, address, raw_message, is_settled, order_date,
          crm_customers:customer_id (address_name, city),
          crm_couriers(id, name, phone_number, telegram_id)
        `)
      
      const { data: shiftOrders } = isCloseoutRecent
        ? await query.gt('order_date', shiftStart).lte('order_date', shiftEnd)
        : await query.gte('order_date', shiftStart).lte('order_date', shiftEnd)

      const orders = shiftOrders || []
      const totalOrders = orders.length

      // 3. Compute detailed per-courier breakdown
      // Standard = ₪100, Bat Yam = ₪50
      const STANDARD_FEE = 100
      const BAT_YAM_FEE = 50

      const courierMap = new Map<string, {
        courier_id: string
        courier_name: string
        courier_phone?: string
        courier_telegram_id?: number | string | null
        orders_count: number
        gross_collected: number
        cash_collected: number
        bit_collected: number
        standard_count: number
        bat_yam_count: number
        courier_fee: number
        bonus: number
        net_to_safe: number
      }>()

      for (const o of orders) {
        const c = (o as any).crm_couriers
        const cId = c?.id || o.courier_id || 'unassigned'
        const cName = c?.name || (cId === 'unassigned' ? 'ללא שליח משובץ' : 'שליח')

        if (!courierMap.has(cId)) {
          courierMap.set(cId, {
            courier_id: cId,
            courier_name: cName,
            courier_phone: c?.phone_number,
            courier_telegram_id: c?.telegram_id,
            orders_count: 0,
            gross_collected: 0,
            cash_collected: 0,
            bit_collected: 0,
            standard_count: 0,
            bat_yam_count: 0,
            courier_fee: 0,
            bonus: 0,
            net_to_safe: 0
          })
        }

        const entry = courierMap.get(cId)!
        entry.orders_count += 1
        const price = Number(o.total_price) || 0
        const payInfo = getOrderPaymentInfo(o)
        const isPrepaidBit = payInfo.isPrepaid
        const physicalCash = isPrepaidBit ? 0 : price
        const bitAmount = isPrepaidBit ? price : 0

        entry.gross_collected += price
        entry.cash_collected += physicalCash
        entry.bit_collected += bitAmount

        if (cId !== 'unassigned') {
          const combined = [
            o.city || '',
            o.address || '',
            (o as any).crm_customers?.city || '',
            (o as any).crm_customers?.address_name || '',
            (o as any).raw_message || ''
          ].join(' ').toLowerCase()

          const isBatYam =
            combined.includes('בת ים') ||
            combined.includes('בת-ים') ||
            combined.includes('בתים') ||
            combined.includes('יוספטל') ||
            combined.includes('יוסף טל') ||
            combined.includes('בלפור') ||
            combined.includes('הקוממיות') ||
            combined.includes('bat yam') ||
            combined.includes('bat-yam') ||
            combined.includes('batyam') ||
            combined.includes('yoseftal')

          if (isBatYam) {
            entry.bat_yam_count += 1
            entry.courier_fee += BAT_YAM_FEE
          } else {
            entry.standard_count += 1
            entry.courier_fee += STANDARD_FEE
          }
        }
      }

      // 3b. Fetch all recorded settlements in this active shift to include recorded bonuses & courier fees
      const { data: shiftSettlements } = await supabaseAdmin
        .from('cash_settlements')
        .select('courier_id, courier_pay, bonus_amount, notes')
        .eq('status', 'SETTLED')
        .gt('created_at', shiftStart)
        .lte('created_at', shiftEnd)

      const courierBonusMap = new Map<string, number>()
      for (const s of shiftSettlements || []) {
        if (s.courier_id && !s.notes?.includes('סגירת יום רשמית')) {
          const currentBonus = courierBonusMap.get(s.courier_id) || 0
          courierBonusMap.set(s.courier_id, currentBonus + (Number(s.bonus_amount) || 0))
        }
      }

      let totalGross = 0
      let totalPhysicalCash = 0
      let totalBitCredit = 0
      let totalCourierPay = 0
      let totalBonus = 0
      const courierBreakdown: any[] = []

      courierMap.forEach((entry) => {
        const bonus = courierBonusMap.get(entry.courier_id) || 0
        entry.bonus = bonus
        entry.courier_fee += bonus
        // The courier only deposits physical cash in the safe! Bit was collected directly by provider.
        entry.net_to_safe = Math.max(0, entry.cash_collected - entry.courier_fee)
        totalGross += entry.gross_collected
        totalPhysicalCash += entry.cash_collected
        totalBitCredit += entry.bit_collected
        totalCourierPay += entry.courier_fee
        totalBonus += bonus
        courierBreakdown.push(entry)
      })

      const totalNetToSafe = Math.max(0, totalPhysicalCash - totalCourierPay)
      const creditProviderBalance = totalBitCredit
      const totalOverallBusinessProfit = totalNetToSafe + creditProviderBalance

      // 4. Mark all orders in this shift as settled
      if (isCloseoutRecent) {
        await supabaseAdmin
          .from('crm_orders')
          .update({ is_settled: true })
          .gt('order_date', shiftStart)
          .lte('order_date', shiftEnd)
      } else {
        await supabaseAdmin
          .from('crm_orders')
          .update({ is_settled: true })
          .gte('order_date', shiftStart)
          .lte('order_date', shiftEnd)
      }

      // Also create cash_settlements rows for any courier who had orders
      for (const cEntry of courierBreakdown) {
        if (cEntry.courier_id !== 'unassigned') {
          try {
            await supabaseAdmin.from('cash_settlements').insert({
              courier_id: cEntry.courier_id,
              total_collected: cEntry.gross_collected,
              gross_collected: cEntry.gross_collected,
              courier_pay: cEntry.courier_fee,
              bonus_amount: cEntry.bonus,
              net_expected: cEntry.net_to_safe,
              amount_received: cEntry.net_to_safe,
              status: 'SETTLED',
              notes: `סגירת יום רשמית (${cEntry.orders_count} משלוחים | עמלה: ₪${cEntry.courier_fee}${cEntry.bonus > 0 ? ` [כולל ₪${cEntry.bonus} בונוס]` : ''}${cEntry.bit_collected > 0 ? ` [ביט: ₪${cEntry.bit_collected}]` : ''} | נטו לכספת: ₪${cEntry.net_to_safe})`
            })
          } catch (e) {}
        }
      }

      // 5. Save the Day Closeout record
      const closeoutRecord = {
        id: crypto.randomUUID(),
        closeout_date: getIsraelDateString(),
        shift_start: shiftStart,
        shift_end: shiftEnd,
        total_orders: totalOrders,
        gross_collected: totalGross,
        total_physical_cash: totalPhysicalCash,
        total_bit_credit: totalBitCredit,
        credit_provider_balance: creditProviderBalance,
        total_courier_pay: totalCourierPay,
        total_bonus: totalBonus,
        net_to_safe: totalNetToSafe,
        total_net_profit: totalOverallBusinessProfit,
        courier_breakdown: courierBreakdown,
        notes: notes || 'סגירת יום מוצלחת',
        closed_by: user.id,
        closed_by_name: user.user_metadata?.name || user.email || 'מנהל משמרת',
        created_at: shiftEnd
      }

      try {
        await supabaseAdmin
          .from('crm_day_closeouts')
          .insert(closeoutRecord)
      } catch (e) {
        // Fallback if DB table has base schema without extra columns
        try {
          await supabaseAdmin
            .from('crm_day_closeouts')
            .insert({
              id: closeoutRecord.id,
              closeout_date: closeoutRecord.closeout_date,
              shift_start: closeoutRecord.shift_start,
              shift_end: closeoutRecord.shift_end,
              total_orders: closeoutRecord.total_orders,
              gross_collected: closeoutRecord.gross_collected,
              total_courier_pay: closeoutRecord.total_courier_pay,
              total_bonus: closeoutRecord.total_bonus,
              net_to_safe: closeoutRecord.net_to_safe,
              courier_breakdown: closeoutRecord.courier_breakdown,
              notes: closeoutRecord.notes,
              closed_by: closeoutRecord.closed_by,
              closed_by_name: closeoutRecord.closed_by_name,
              created_at: closeoutRecord.created_at
            })
        } catch (subErr) {}
      }

      // Save to local fallback file for guaranteed persistence
      saveLocalDayCloseout(closeoutRecord)

      // 6. DISPATCH TELEGRAM MESSAGES
      const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
      const closeDateFormatted = new Date(shiftEnd).toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      const closeTimeFormatted = new Date(shiftEnd).toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit'
      })

      // Courier breakdown cards formatted cleanly for mobile screens
      const courierWarehouseCards = courierBreakdown
        .filter(c => c.courier_id !== 'unassigned')
        .map(c => {
          const batYamStr = c.bat_yam_count > 0 ? `(כולל ${c.bat_yam_count} בת ים × ₪50)` : ''
          const bonusStr = c.bonus > 0 ? `(כולל ₪${c.bonus.toLocaleString()} בונוס)` : ''
          const detailsStr = [batYamStr, bonusStr].filter(Boolean).join(' ')
          const bitNote = c.bit_collected > 0 ? `  ▫️ שולם בביט: ₪${c.bit_collected.toLocaleString()} (בסליקה)\n` : ''
          return (
            `🛵 *${c.courier_name}* • ${c.orders_count} משלוחים${detailsStr ? ` ${detailsStr}` : ''}\n` +
            `  ▫️ גבייה ברוטו: ₪${c.gross_collected.toLocaleString()}\n` +
            bitNote +
            `  ▫️ מזומן פיזי שנגבה: ₪${c.cash_collected.toLocaleString()}\n` +
            `  ▫️ עמלת שליח: ₪${c.courier_fee.toLocaleString()}\n` +
            `  📥 *מעטפה לגבייה לכספת: ₪${c.net_to_safe.toLocaleString()}*`
          )
        })
        .join('\n\n') || 'ללא פעילות שליחים'

      const courierAccountantCards = courierBreakdown
        .filter(c => c.courier_id !== 'unassigned')
        .map(c => {
          const batYamStr = c.bat_yam_count > 0 ? ` (כולל ${c.bat_yam_count} בת ים × ₪50)` : ''
          const bonusStr = c.bonus > 0 ? ` (כולל ₪${c.bonus.toLocaleString()} בונוס)` : ''
          const bitNote = c.bit_collected > 0 ? `  ▫️ מתוכם בביט/סליקה: ₪${c.bit_collected.toLocaleString()}\n` : ''
          return (
            `🛵 *${c.courier_name}* • ${c.orders_count} משלוחים\n` +
            `  ▫️ מחזור ברוטו: ₪${c.gross_collected.toLocaleString()}\n` +
            bitNote +
            `  ▫️ עמלת שליח: ₪${c.courier_fee.toLocaleString()}${batYamStr}${bonusStr}\n` +
            `  💵 *נטו מזומן לכספת: ₪${c.net_to_safe.toLocaleString()}*`
          )
        })
        .join('\n\n') || 'ללא פעילות שליחים'

      // Message 1: To Warehouseman (Physical Cash Envelopes Collection & Safe Deposit)
      const warehouseMessage =
        `🌙 *דוח סגירת יום וכספת | דוח Z*\n` +
        `📅 *תאריך:* ${closeDateFormatted} • *שעה:* ${closeTimeFormatted}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📦 *סיכום סבב משלוחים:*\n` +
        `▫️ סה״כ משלוחים שסופקו: *${totalOrders}*\n` +
        `▫️ מחזור מכירות כללי: *₪${totalGross.toLocaleString()}*\n` +
        `  ▫️ גביית מזומן פיזי משליחים: *₪${totalPhysicalCash.toLocaleString()}*\n` +
        `  ▫️ שולם מראש בביט / אשראי: *₪${totalBitCredit.toLocaleString()}*\n` +
        `▫️ סך עמלות שליחים ששולמו: *₪${totalCourierPay.toLocaleString()}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💵 *סך נטו מזומן להפקדה בכספת:*\n` +
        `💰 *₪${totalNetToSafe.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 *יתרה אצל ספק אשראי / ביט (טרם נמשך):*\n` +
        `💳 *₪${totalBitCredit.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏦 *סה״כ רווח נקי כולל לעסק (כספת + ביט):*\n` +
        `💎 *₪${totalOverallBusinessProfit.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *פירוט מעטפות מזומן לגבייה מכל שליח:*\n\n` +
        `${courierWarehouseCards}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        (notes ? `📝 *הערות מנהל משמרת:* ${notes}\n\n` : '') +
        `🔒 *חובה על המחסנאי לוודא קבלת כל המעטפות במזומן ונעילתן בכספת.*`

      // Message 2: To Accounting Manager (Full Financial Audit Report)
      const accountantMessage =
        `📊 *דוח יומי פיננסי — הנהלת חשבונות | דוח Z*\n` +
        `📅 *תאריך:* ${closeDateFormatted} • *שעה:* ${closeTimeFormatted}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📈 *סיכום פיננסי יומי:*\n` +
        `▫️ סה״כ הזמנות שנמסרו: *${totalOrders}*\n` +
        `▫️ מחזור מכירות כולל: *₪${totalGross.toLocaleString()}*\n` +
        `  ▫️ תקבולים במזומן (שליחים): *₪${totalPhysicalCash.toLocaleString()}*\n` +
        `  ▫️ תקבולים בסליקה / ביט: *₪${totalBitCredit.toLocaleString()}*\n` +
        `▫️ הוצאות עמלות שליחים: *₪${totalCourierPay.toLocaleString()}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💵 *רווח נטו במזומן שהופקד לכספת:*\n` +
        `💰 *₪${totalNetToSafe.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 *יתרה לגבייה מספק אשראי / ביט:*\n` +
        `💳 *₪${totalBitCredit.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏦 *סה״כ רווח נקי כולל לעסק (מזומן + אשראי):*\n` +
        `💎 *₪${totalOverallBusinessProfit.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👥 *פירוט הכנסות ועמלות לפי שליח:*\n\n` +
        `${courierAccountantCards}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        (notes ? `📝 *הערות מנהל:* ${notes}\n\n` : '') +
        `✅ *סטטוס משמרת:* סגירת יום הושלמה בהצלחה. הקופה אופסה ליום חדש.`

      // Resolve recipient Telegram IDs
      const warehouseTelegramIds = new Set<string>()
      const accountantTelegramIds = new Set<string>()

      // 1. Warehousemen and admins receive the preferred cash & safe closeout report (Message 1)
      const whEnv = (process.env.WAREHOUSE_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
      whEnv.forEach(id => warehouseTelegramIds.add(id))

      const adminIds = (process.env.ALLOWED_TELEGRAM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
      adminIds.forEach(id => warehouseTelegramIds.add(id))

      // 2. Dedicated accountant IDs (if specifically configured)
      const accEnv = (process.env.ACCOUNTANT_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
      accEnv.forEach(id => accountantTelegramIds.add(id))

      // 3. Fetch profiles from database
      try {
        const { data: allProfiles } = await supabaseAdmin.from('profiles').select('id, role, phone_number')
        const { data: crmRoster } = await supabaseAdmin.from('crm_couriers').select('phone_number, telegram_id, name')
        const { data: authUsersList } = await supabaseAdmin.auth.admin.listUsers()

        // Match warehouseman and accountant profiles
        for (const u of authUsersList?.users || []) {
          const metaRole = u.user_metadata?.role
          const metaTg = u.user_metadata?.telegram_id
          if (metaRole === 'warehouseman' && metaTg) {
            warehouseTelegramIds.add(String(metaTg).trim())
          }
          if (metaRole === 'accountant' && metaTg) {
            accountantTelegramIds.add(String(metaTg).trim())
          }
        }

        for (const wp of allProfiles || []) {
          if (wp.role === 'warehouseman') {
            const cleanPhone = (wp.phone_number || '').replace(/\D/g, '')
            const matched = (crmRoster || []).find(r => (r.phone_number || '').replace(/\D/g, '').endsWith(cleanPhone.slice(-9)))
            if (matched?.telegram_id) warehouseTelegramIds.add(String(matched.telegram_id).trim())
            const authMatch = (authUsersList?.users || []).find(u => u.id === wp.id)
            if (authMatch?.user_metadata?.telegram_id) warehouseTelegramIds.add(String(authMatch.user_metadata.telegram_id).trim())
          }
          if (wp.role === 'accountant') {
            const cleanPhone = (wp.phone_number || '').replace(/\D/g, '')
            const matched = (crmRoster || []).find(r => (r.phone_number || '').replace(/\D/g, '').endsWith(cleanPhone.slice(-9)))
            if (matched?.telegram_id) accountantTelegramIds.add(String(matched.telegram_id).trim())
            const authMatch = (authUsersList?.users || []).find(u => u.id === wp.id)
            if (authMatch?.user_metadata?.telegram_id) accountantTelegramIds.add(String(authMatch.user_metadata.telegram_id).trim())
          }
        }
      } catch (e) {}

      // CRITICAL: Ensure warehousemen / admins NEVER receive a duplicate accountant message!
      // They receive strictly ONE clear, organized message: the warehouse cash & safe report.
      for (const whId of warehouseTelegramIds) {
        accountantTelegramIds.delete(whId)
      }

      let warehouseSent = 0
      let accountantSent = 0

      if (botToken) {
        for (const whId of warehouseTelegramIds) {
          try {
            const ok = await sendTelegramMessage(botToken, {
              chat_id: whId,
              text: warehouseMessage,
              parse_mode: 'Markdown'
            })
            if (ok) warehouseSent++
          } catch (e) {}
        }

        for (const accId of accountantTelegramIds) {
          try {
            const ok = await sendTelegramMessage(botToken, {
              chat_id: accId,
              text: accountantMessage,
              parse_mode: 'Markdown'
            })
            if (ok) accountantSent++
          } catch (e) {}
        }
      }

      return NextResponse.json({
        success: true,
        closeout: closeoutRecord,
        warehouseSent,
        accountantSent,
        message: 'יום העבודה נסגר בהצלחה! הדוחות המפורטים נשלחו למחסנאי ולהנהלת חשבונות.'
      })
    }

    if (action === 'PURGE_DEMO_DATA') {
      // Safely delete order-related tables, preserving catalog brands, products, and registered couriers
      await supabaseAdmin.from('inventory_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabaseAdmin.from('crm_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabaseAdmin.from('cash_settlements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabaseAdmin.from('crm_customers').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      return NextResponse.json({ 
        success: true, 
        message: 'All demo orders, settlements, and customer records have been purged. Database is a clean slate for live Telegram ingestion.' 
      })
    }

    // ========================================================
    // 1. PRODUCTS CRUD HANDLERS (WAREHOUSE CATALOG 29/9)
    // ========================================================
    if (action === 'CREATE_PRODUCT') {
      const { name, category, unit, stock_on_hand, min_stock_alert, aliases } = body
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Product name is required.' }, { status: 400 })
      }

      const initialStock = Number(stock_on_hand) || 0
      const aliasArray = Array.isArray(aliases)
        ? aliases.map((a: string) => a.trim()).filter(Boolean)
        : typeof aliases === 'string'
        ? aliases.split(',').map((a: string) => a.trim()).filter(Boolean)
        : []

      const { data: newProd, error: prodErr } = await supabaseAdmin
        .from('products')
        .insert({
          name: name.trim(),
          category: (category || 'תפרחת').trim(),
          unit: unit === 'units' ? 'units' : 'g',
          stock_on_hand: initialStock,
          min_stock_alert: Number(min_stock_alert) || 10,
          aliases: aliasArray
        })
        .select()
        .single()

      if (prodErr) {
        return NextResponse.json({ error: prodErr.message }, { status: 400 })
      }

      if (initialStock > 0) {
        await supabaseAdmin.from('inventory_transactions').insert({
          product_id: newProd.id,
          quantity: initialStock,
          reason: 'INITIAL_STOCK',
          notes: `Initial warehouse catalog stock for ${newProd.name}`
        })
      }

      return NextResponse.json({ success: true, product: newProd })
    }

    if (action === 'UPDATE_PRODUCT') {
      const { productId, name, category, unit, min_stock_alert, aliases } = body
      if (!productId) {
        return NextResponse.json({ error: 'Missing productId' }, { status: 400 })
      }

      const aliasArray = Array.isArray(aliases)
        ? aliases.map((a: string) => a.trim()).filter(Boolean)
        : typeof aliases === 'string'
        ? aliases.split(',').map((a: string) => a.trim()).filter(Boolean)
        : []

      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString()
      }
      if (name && typeof name === 'string') updatePayload.name = name.trim()
      if (category && typeof category === 'string') updatePayload.category = category.trim()
      if (unit && (unit === 'g' || unit === 'units')) updatePayload.unit = unit
      if (min_stock_alert !== undefined) updatePayload.min_stock_alert = Number(min_stock_alert) || 10
      if (aliases !== undefined) updatePayload.aliases = aliasArray

      const { data: updatedProd, error: updateErr } = await supabaseAdmin
        .from('products')
        .update(updatePayload)
        .eq('id', productId)
        .select()
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, product: updatedProd })
    }

    if (action === 'DELETE_PRODUCT') {
      const { productId } = body
      if (!productId) {
        return NextResponse.json({ error: 'Missing productId' }, { status: 400 })
      }

      // Check if product has active inventory transactions
      await supabaseAdmin.from('inventory_transactions').delete().eq('product_id', productId)
      const { error: delErr } = await supabaseAdmin.from('products').delete().eq('id', productId)

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, deletedProductId: productId })
    }

    // ========================================================
    // 2. BRANDS CRUD HANDLERS (37+ BRAND PERSONAS)
    // ========================================================
    if (action === 'CREATE_BRAND') {
      const { name } = body
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Brand name is required.' }, { status: 400 })
      }

      const { data: newBrand, error: brandErr } = await supabaseAdmin
        .from('brands')
        .insert({ name: name.trim() })
        .select()
        .single()

      if (brandErr) {
        return NextResponse.json({ error: brandErr.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, brand: newBrand })
    }

    if (action === 'UPDATE_BRAND') {
      const { brandId, name } = body
      if (!brandId || !name || !name.trim()) {
        return NextResponse.json({ error: 'Missing brandId or brand name' }, { status: 400 })
      }

      const { data: updatedBrand, error: updateErr } = await supabaseAdmin
        .from('brands')
        .update({ name: name.trim() })
        .eq('id', brandId)
        .select()
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, brand: updatedBrand })
    }

    if (action === 'DELETE_BRAND') {
      const { brandId } = body
      if (!brandId) {
        return NextResponse.json({ error: 'Missing brandId' }, { status: 400 })
      }

      // Check if orders exist with this brand
      const { data: linkedOrders, count: orderCount } = await supabaseAdmin
        .from('crm_orders')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)

      if (orderCount && orderCount > 0) {
        return NextResponse.json({ 
          error: `Cannot delete brand: ${orderCount} existing delivery orders are tied to it. Consider renaming it instead.` 
        }, { status: 400 })
      }

      // Nullify customer references if any
      await supabaseAdmin.from('crm_customers').update({ last_brand_id: null }).eq('last_brand_id', brandId)

      const { error: delErr } = await supabaseAdmin.from('brands').delete().eq('id', brandId)
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, deletedBrandId: brandId })
    }

    // ========================================================
    // 3. COURIERS CRUD HANDLERS
    // ========================================================
    if (action === 'CREATE_COURIER') {
      const { name, phone_number, telegram_id } = body
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Courier name is required.' }, { status: 400 })
      }

      const { data: newCourier, error: courierErr } = await supabaseAdmin
        .from('crm_couriers')
        .insert({
          name: name.trim(),
          phone_number: phone_number?.trim() || null,
          telegram_id: telegram_id ? Number(telegram_id) : null,
          is_active: true
        })
        .select()
        .single()

      if (courierErr) {
        return NextResponse.json({ error: courierErr.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, courier: newCourier })
    }

    if (action === 'UPDATE_COURIER') {
      const { courierId, name, phone_number, telegram_id, is_active } = body
      if (!courierId) {
        return NextResponse.json({ error: 'Missing courierId' }, { status: 400 })
      }

      const updatePayload: Record<string, any> = {}
      if (name && typeof name === 'string') updatePayload.name = name.trim()
      if (phone_number !== undefined) updatePayload.phone_number = phone_number?.trim() || null
      if (telegram_id !== undefined) updatePayload.telegram_id = telegram_id ? Number(telegram_id) : null
      if (is_active !== undefined) updatePayload.is_active = !!is_active

      const { data: updatedCourier, error: updateErr } = await supabaseAdmin
        .from('crm_couriers')
        .update(updatePayload)
        .eq('id', courierId)
        .select()
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, courier: updatedCourier })
    }

    if (action === 'DELETE_COURIER') {
      const { courierId } = body
      if (!courierId) {
        return NextResponse.json({ error: 'Missing courierId' }, { status: 400 })
      }

      // Check if orders exist; if so, set courier_id to null or soft delete
      await supabaseAdmin.from('crm_orders').update({ courier_id: null }).eq('courier_id', courierId)
      await supabaseAdmin.from('cash_settlements').delete().eq('courier_id', courierId)

      const { error: delErr } = await supabaseAdmin.from('crm_couriers').delete().eq('id', courierId)
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, deletedCourierId: courierId })
    }

    if (action === 'DELETE_ORDER') {
      const { orderId } = body
      if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
      }

      // 1. Fetch order
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('crm_orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      // 2. Rollback inventory transactions: restore stock for each deducted product
      const { data: transactions } = await supabaseAdmin
        .from('inventory_transactions')
        .select('id, product_id, quantity')
        .eq('order_id', orderId)

      for (const tx of transactions || []) {
        if (Number(tx.quantity) < 0) {
          const qtyToRestore = Math.abs(Number(tx.quantity))
          const { data: prod } = await supabaseAdmin
            .from('products')
            .select('stock_on_hand, name')
            .eq('id', tx.product_id)
            .single()

          if (prod) {
            const restoredStock = Number(prod.stock_on_hand || 0) + qtyToRestore
            await supabaseAdmin
              .from('products')
              .update({ stock_on_hand: restoredStock, updated_at: new Date().toISOString() })
              .eq('id', tx.product_id)

            // Log restock audit
            await supabaseAdmin.from('inventory_transactions').insert({
              product_id: tx.product_id,
              order_id: null,
              quantity: qtyToRestore,
              reason: 'ORDER_CANCELLED_RESTOCK',
              notes: `Stock restored from cancelled order ${orderId} (${prod.name})`
            })
          }
        }
      }

      // Delete the original order inventory transactions
      await supabaseAdmin.from('inventory_transactions').delete().eq('order_id', orderId)

      // 3. Rollback customer total spent & order count
      if (order.customer_id) {
        const { data: cust } = await supabaseAdmin
          .from('crm_customers')
          .select('total_orders, total_spent')
          .eq('id', order.customer_id)
          .single()

        if (cust) {
          const newOrders = Math.max(0, (cust.total_orders || 1) - 1)
          const newSpent = Math.max(0, Number(cust.total_spent || 0) - Number(order.total_price || 0))
          await supabaseAdmin
            .from('crm_customers')
            .update({
              total_orders: newOrders,
              total_spent: newSpent,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.customer_id)
        }
      }

      // 4. Delete the order from crm_orders
      const { error: delErr } = await supabaseAdmin.from('crm_orders').delete().eq('id', orderId)
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 })
      }

      // 5. Notify assigned courier via Telegram if order is cancelled
      if (order.courier_id) {
        try {
          const { data: assignedCourier } = await supabaseAdmin
            .from('crm_couriers')
            .select('id, name, telegram_id')
            .eq('id', order.courier_id)
            .maybeSingle()

          if (assignedCourier?.telegram_id) {
            const botToken = process.env.TELEGRAM_BOT_TOKEN
            if (botToken) {
              const cancelAlert = `🚫 *ביטול משלוח!*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${order.address}
🏙️ *עיר:* ${order.city || 'מרכז'}
💰 *סכום שבוטל:* ₪${Number(order.total_price || 0).toLocaleString()} מזומן

המשלוח בוטל במערכת. אין צורך לספק ללקוח או לגבות כסף.`

              await sendTelegramMessage(botToken, {
                chat_id: assignedCourier.telegram_id,
                parse_mode: 'Markdown',
                text: cancelAlert
              })
            }
          }
        } catch (teleErr) {
          console.warn('[CRM API] Telegram cancel alert error:', teleErr)
        }
      }

      return NextResponse.json({ success: true, deletedOrderId: orderId })
    }

    if (action === 'UPDATE_ORDER') {
      const { orderId, rawMessage, courierId, manualFields } = body
      if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
      }

      // 1. Fetch current order
      const { data: currentOrder, error: orderErr } = await supabaseAdmin
        .from('crm_orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderErr || !currentOrder) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      let newAddress = currentOrder.address
      let newCity = currentOrder.city
      let newMenuItems = currentOrder.menu_items
      let newActualItems = currentOrder.actual_items
      let newTotalPrice = Number(currentOrder.total_price) || 0
      let newBrandId = currentOrder.brand_id
      let newCourierId = courierId !== undefined ? courierId : currentOrder.courier_id
      let finalRawMessage = rawMessage !== undefined ? rawMessage : currentOrder.raw_message

      // If rawMessage was edited, parse it and reconcile deductions!
      if (rawMessage && typeof rawMessage === 'string' && rawMessage.trim()) {
        const parsed = parseDeliveryMessage(rawMessage.trim())
        if (parsed.customerName) newAddress = parsed.customerName
        if (parsed.city) newCity = parsed.city
        if (parsed.menuItems) newMenuItems = parsed.menuItems
        if (parsed.actualItems) newActualItems = parsed.actualItems
        if (parsed.totalPrice > 0) newTotalPrice = parsed.totalPrice

        // Resolve brand if matched
        if (parsed.brand) {
          const { data: matchedBrand } = await supabaseAdmin
            .from('brands')
            .select('id')
            .eq('name', parsed.brand)
            .maybeSingle()
          if (matchedBrand) newBrandId = matchedBrand.id
        }

        // Reconcile Inventory:
        // A. Restore previous deductions for this order
        const { data: prevTx } = await supabaseAdmin
          .from('inventory_transactions')
          .select('id, product_id, quantity')
          .eq('order_id', orderId)

        for (const tx of prevTx || []) {
          if (Number(tx.quantity) < 0) {
            const qtyBack = Math.abs(Number(tx.quantity))
            const { data: p } = await supabaseAdmin.from('products').select('stock_on_hand').eq('id', tx.product_id).single()
            if (p) {
              await supabaseAdmin.from('products').update({
                stock_on_hand: Number(p.stock_on_hand || 0) + qtyBack,
                updated_at: new Date().toISOString()
              }).eq('id', tx.product_id)
            }
          }
        }
        // Remove previous transactions for this order
        await supabaseAdmin.from('inventory_transactions').delete().eq('order_id', orderId)

        // B. Apply new deductions
        for (const d of parsed.deductions) {
          const { data: prod } = await supabaseAdmin
            .from('products')
            .select('id, name, unit, stock_on_hand')
            .eq('name', d.warehouseProductName)
            .maybeSingle()

          if (prod) {
            const newStock = Math.max(0, Number(prod.stock_on_hand || 0) - Math.abs(d.quantity))
            await supabaseAdmin.from('products').update({
              stock_on_hand: newStock,
              updated_at: new Date().toISOString()
            }).eq('id', prod.id)

            await supabaseAdmin.from('inventory_transactions').insert({
              product_id: prod.id,
              order_id: orderId,
              quantity: -Math.abs(d.quantity),
              reason: 'DISPATCH_DEDUCTION',
              notes: `Updated deduction from edited order ${orderId}`
            })
          }
        }
      } else if (manualFields) {
        // Manual field override (e.g. changing price or address directly)
        if (manualFields.address !== undefined) newAddress = manualFields.address
        if (manualFields.city !== undefined) newCity = manualFields.city
        if (manualFields.totalPrice !== undefined) newTotalPrice = Number(manualFields.totalPrice) || 0
        if (manualFields.menuItems !== undefined) newMenuItems = manualFields.menuItems
        if (manualFields.actualItems !== undefined) newActualItems = manualFields.actualItems
      }

      // Update customer total_spent difference
      if (currentOrder.customer_id && newTotalPrice !== Number(currentOrder.total_price)) {
        const delta = newTotalPrice - Number(currentOrder.total_price)
        const { data: cust } = await supabaseAdmin
          .from('crm_customers')
          .select('total_spent')
          .eq('id', currentOrder.customer_id)
          .single()
        if (cust) {
          await supabaseAdmin
            .from('crm_customers')
            .update({
              total_spent: Math.max(0, Number(cust.total_spent || 0) + delta),
              updated_at: new Date().toISOString()
            })
            .eq('id', currentOrder.customer_id)
        }
      }

      // Update order in crm_orders
      const { data: updatedOrder, error: updateErr } = await supabaseAdmin
        .from('crm_orders')
        .update({
          address: newAddress,
          city: newCity,
          menu_items: newMenuItems,
          actual_items: newActualItems,
          total_price: newTotalPrice,
          brand_id: newBrandId,
          courier_id: newCourierId,
          raw_message: finalRawMessage
        })
        .eq('id', orderId)
        .select(`
          id, customer_id, brand_id, courier_id, address, city,
          menu_items, actual_items, total_price, is_settled,
          raw_message, order_date, created_at,
          brands(id, name),
          crm_couriers(id, name, phone_number, telegram_id),
          crm_customers(id, address_name, phone_number, telegram_handle, customer_type)
        `)
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }

      // 5. Notify assigned courier via Telegram if price, address, items, or courier was changed
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (botToken) {
        try {
          const oldCourierId = currentOrder.courier_id
          const newCourierId = updatedOrder.courier_id
          const courierObj: any = updatedOrder.crm_couriers

          // Case A: Courier Reassigned
          if (oldCourierId !== newCourierId) {
            // Notify old courier that order was transferred
            if (oldCourierId) {
              const { data: oldCourier } = await supabaseAdmin
                .from('crm_couriers')
                .select('telegram_id')
                .eq('id', oldCourierId)
                .maybeSingle()

              if (oldCourier?.telegram_id) {
                await sendTelegramMessage(botToken, {
                  chat_id: oldCourier.telegram_id,
                  parse_mode: 'Markdown',
                  text: `🔄 *הזמנה הועברה לשליח אחר*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${currentOrder.address}
המשלוח הועבר לטיפול שליח אחר.`
                })
              }
            }

            const payInfo = getOrderPaymentInfo(updatedOrder)
            const priceDisplay = payInfo.isPrepaid
              ? 'שולם מראש (0₪ מזומן) 💳'
              : `₪${Number(updatedOrder.total_price || 0).toLocaleString()} מזומן`
            const prepaidWarning = payInfo.isPrepaid
              ? `\n💳 *סטטוס תשלום:* ${payInfo.labelHe} — *אין לגבות מזומן מהלקוח!*`
              : ''

            // Notify new courier of new dispatch
            if (courierObj?.telegram_id) {
              await sendTelegramMessage(botToken, {
                chat_id: courierObj.telegram_id,
                parse_mode: 'Markdown',
                text: `🛵 *הזמנה חדשה שובצה עבורך!*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${updatedOrder.address}
🏙️ *עיר:* ${updatedOrder.city || 'מרכז'}
💵 *סכום לגבייה:* ${priceDisplay}${prepaidWarning}
📦 *פריטים:* ${updatedOrder.menu_items || updatedOrder.actual_items || '—'}`
              })
            }
          } else if (courierObj?.telegram_id) {
            // Case B: Same courier, check if price, items, or address changed
            const priceChanged = Number(currentOrder.total_price) !== Number(updatedOrder.total_price)
            const addressChanged = currentOrder.address !== updatedOrder.address || currentOrder.city !== updatedOrder.city
            const itemsChanged = currentOrder.menu_items !== updatedOrder.menu_items || currentOrder.actual_items !== updatedOrder.actual_items

            if (priceChanged || addressChanged || itemsChanged) {
              const oldPriceNum = Number(currentOrder.total_price || 0)
              const newPriceNum = Number(updatedOrder.total_price || 0)
              const payInfo = getOrderPaymentInfo(updatedOrder)
              const priceDisplay = payInfo.isPrepaid
                ? 'שולם מראש (0₪ מזומן) 💳'
                : `₪${newPriceNum.toLocaleString()} מזומן`
              const prepaidWarning = payInfo.isPrepaid
                ? `\n💳 *הנחיה לשליח:* ${payInfo.labelHe} — *אין לגבות מזומן מהלקוח!*`
                : ''

              const updateAlert = `⚠️ *עדכון הזמנה / שינוי סכום לגבייה!*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${updatedOrder.address}${addressChanged ? ` _(עודכן מ-${currentOrder.address})_` : ''}
🏙️ *עיר:* ${updatedOrder.city || 'מרכז'}
💵 *סכום מעודכן לגבייה:* ${priceDisplay}${
                priceChanged && !payInfo.isPrepaid
                  ? ` _(עודכן מ-₪${oldPriceNum.toLocaleString()})_`
                  : ''
              }${prepaidWarning}
${itemsChanged ? `📦 *פריטים מעודכנים:* ${updatedOrder.menu_items || updatedOrder.actual_items || '—'}\n` : ''}
🕒 *שעת עדכון:* ${new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })}`

              await sendTelegramMessage(botToken, {
                chat_id: courierObj.telegram_id,
                parse_mode: 'Markdown',
                text: updateAlert
              })
            }
          }
        } catch (teleErr) {
          console.warn('[CRM API] Telegram order update alert error:', teleErr)
        }
      }

      return NextResponse.json({ success: true, order: updatedOrder })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[CRM API] Unexpected error in POST:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
