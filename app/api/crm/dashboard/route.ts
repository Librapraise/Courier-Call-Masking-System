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
import { matchBrand } from '@/lib/crm/fuzzy-matcher'
import { getCached, setCached, invalidateDashboardCache } from '@/lib/crm/cache'
import { getLocalProductCosts, saveLocalProductCost, saveLocalProductCostsBatch } from '@/lib/crm/product-costs'
import { parseBatchDepletionMessage, formatDepletionTelegramReport } from '@/lib/crm/depletion-parser'

// In-memory staff authorization cache (60 seconds TTL)
const staffAuthCache = new Map<string, { isStaff: boolean; expiresAt: number }>()

function getCleanCourierDisplayItems(order: { menu_items?: string | null; actual_items?: string | null }): string {
  const rawItemsStr = order.menu_items || order.actual_items || '—'
  const chunks = rawItemsStr.split(/[\n,]/).map(s => s.trim()).filter(Boolean)

  const cleanedItems: string[] = []
  for (const chunk of chunks) {
    // 1. Skip brand lines
    if (matchBrand(chunk)) continue

    // 2. Skip verification / confirmation lines
    if (/(?:אימות|אושר|אישור|מאושר|בדיקה)/i.test(chunk)) continue

    // 3. Skip payment lines (crypto, bit, credit, cash notes)
    if (
      /(?:שולם|קריפטו|crypto|ביט|bit|אשראי|credit|prepaid|לגבות\s*:\s*0)/i.test(chunk) &&
      !/(?:ביטים|בביטים)/i.test(chunk)
    ) {
      continue
    }

    // 4. Strip warehouse deduction if separated by slash, pipe, dash, or emoji
    let itemText = chunk
    if (/[\/|\\—]/.test(itemText)) {
      itemText = itemText.split(/[\/|\\—]/)[0].trim()
    } else {
      const emojiMatch = itemText.match(/\s*([\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\p{Extended_Pictographic}])\s*/u)
      if (emojiMatch && emojiMatch[1]) {
        const parts = itemText.split(emojiMatch[1])
        if (parts.length >= 2 && parts[0].trim().length > 0 && parts[1].trim().length > 0) {
          if (/(?:רפואי|פופקורן|גדול|קאלי|באצונים|חשיש|תפזורת|שמן|עט|אוראו|האני|מלון|פיינאפל|גלקסי|דקסטר|בוטיק|חממה)/i.test(parts[1])) {
            itemText = parts[0].trim()
          }
        }
      }
    }

    // Strip lingering emojis from item display text so courier gets crisp clean name
    itemText = itemText.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\p{Extended_Pictographic}]/gu, '').trim()

    if (itemText.length > 0 && !matchBrand(itemText)) {
      cleanedItems.push(itemText)
    }
  }

  return cleanedItems.join(', ') || order.actual_items || '—'
}

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

    const now = Date.now()
    const cachedStaff = staffAuthCache.get(user.id)
    let isStaff = false

    if (cachedStaff && cachedStaff.expiresAt > now) {
      isStaff = cachedStaff.isStaff
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      isStaff = isStaffUser(user, profile)
      staffAuthCache.set(user.id, { isStaff, expiresAt: now + 60000 })
    }

    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: Admin, Super Admin, or Warehouseman privileges required.' }, { status: 403 })
    }

    // Ultra-fast sub-millisecond return if dashboard cache is valid
    const cachedDashboard = getCached<any>('crm_dashboard')
    if (cachedDashboard) {
      return NextResponse.json(cachedDashboard)
    }

    // Execute all primary dashboard queries in parallel for maximum speed
    const [
      ordersRes,
      brandsRes,
      productsRes,
      couriersRes,
      closeoutsRes,
      customersRes,
      recentSettlementsRes
    ] = await Promise.all([
      supabaseAdmin
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
        .limit(200),
      supabaseAdmin
        .from('brands')
        .select('id, name')
        .order('name'),
      supabaseAdmin
        .from('products')
        .select('*')
        .order('category'),
      supabaseAdmin
        .from('crm_couriers')
        .select('*')
        .order('name'),
      supabaseAdmin
        .from('crm_day_closeouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('crm_customers')
        .select('*, brands:last_brand_id(name)')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('cash_settlements')
        .select('id, courier_id, settlement_date, gross_collected, courier_pay, bonus_amount, net_expected, amount_received, status, notes, created_at, crm_couriers(name, phone_number, telegram_id)')
        .order('created_at', { ascending: false })
        .limit(15)
    ])

    const orders = ordersRes.data || []
    if (ordersRes.error) {
      console.warn('[CRM API] Orders query fallback:', ordersRes.error.message)
    }

    const brandsData = brandsRes.data
    const brands = brandsData && brandsData.length > 0
      ? brandsData
      : BRANDS_LIST.map((name, i) => ({ id: `brand-${i}`, name }))

    const localCosts = getLocalProductCosts()
    const rawProducts = productsRes.data || []
    const products = rawProducts.map((p: any) => ({
      ...p,
      cost_per_unit: Number(
        p.cost_per_unit !== undefined && p.cost_per_unit !== null
          ? p.cost_per_unit
          : localCosts[p.id] ?? localCosts[p.name] ?? 0
      )
    }))
    let couriersData = couriersRes.data || []

    let recentDayCloseouts: any[] = closeoutsRes.data || []
    let latestDayCloseout: any = recentDayCloseouts.length > 0 ? recentDayCloseouts[0] : null

    if (recentDayCloseouts.length === 0) {
      const localCo = getLocalDayCloseouts()
      if (localCo.length > 0) {
        recentDayCloseouts = localCo
        latestDayCloseout = localCo[0]
      }
    }

    const customersData = customersRes.data || []
    const customerCount = customersData.length
    const recentSettlements = recentSettlementsRes.data || []

    // Active shift boundary: ONLY resets when a Z-Report (day closeout) is executed
    const shiftStartIso = latestDayCloseout
      ? (latestDayCloseout.shift_end || latestDayCloseout.created_at)
      : null

    const allOrders = orders || []
    // Active shift orders: all orders created since the last Z-Report (or all unsettled if no closeout yet)
    const todayOrders = shiftStartIso
      ? allOrders.filter(o => o.order_date > shiftStartIso)
      : allOrders.filter(o => !o.is_settled)
    const totalDeliveriesToday = todayOrders.length
    
    // Courier physical cash currently in the street/courier hands (UNSETTLED only, excluding Bit/crypto/prepaid)
    const courierCashToday = todayOrders
      .filter(o => !o.is_settled && !getOrderPaymentInfo(o).isPrepaid)
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
    
    // Total gross volume across all deliveries in active shift (both settled and pending, cash + bit + crypto)
    const totalCashToday = todayOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)

    // Total amount in Bit / crypto / prepaid in active shift
    const totalBitCreditToday = todayOrders
      .filter(o => getOrderPaymentInfo(o).isPrepaid)
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
    
    // Reconciled physical cash already handed over to the warehouse in this shift
    const reconciledCashToday = todayOrders
      .filter(o => o.is_settled && !getOrderPaymentInfo(o).isPrepaid)
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)


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

    // Fetch active shift cash settlements to compute exact net handed to warehouseman per courier
    let settlementsQuery = supabaseAdmin
      .from('cash_settlements')
      .select('courier_id, amount_received, net_expected, gross_collected')
      .eq('status', 'SETTLED')

    if (shiftStartIso) {
      settlementsQuery = settlementsQuery.gte('created_at', shiftStartIso)
    }

    const { data: todaySettlements } = await settlementsQuery

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


    const responsePayload = {
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
    }

    setCached('crm_dashboard', responsePayload, 2500)
    return NextResponse.json(responsePayload)
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

    // Invalidate dashboard memory cache for any write mutation
    invalidateDashboardCache()

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

    if (action === 'BATCH_DEPLETE_INVENTORY') {
      const { rawMessage, customCosts } = body
      if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
        return NextResponse.json({ error: 'Missing depletion message content' }, { status: 400 })
      }

      // 1. Fetch current catalog products and local costs
      if (customCosts && typeof customCosts === 'object') {
        saveLocalProductCostsBatch(customCosts)
      }
      const activeCosts = getLocalProductCosts()

      const { data: prodsData } = await supabaseAdmin
        .from('products')
        .select('id, name, category, unit, stock_on_hand, min_stock_alert, aliases')

      const prodsList = (prodsData || []).map((p: any) => ({
        ...p,
        cost_per_unit: Number(activeCosts[p.id] ?? activeCosts[p.name] ?? p.cost_per_unit ?? 0)
      }))

      // 2. Fetch today's orders to compute revenue per product
      const { data: latestCloseout } = await supabaseAdmin
        .from('crm_day_closeouts')
        .select('shift_end, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const shiftStartIso = latestCloseout
        ? (latestCloseout.shift_end || latestCloseout.created_at)
        : null

      let ordersQuery = supabaseAdmin
        .from('crm_orders')
        .select('id, total_price, menu_items, actual_items, order_date')

      if (shiftStartIso) {
        ordersQuery = ordersQuery.gt('order_date', shiftStartIso)
      }

      const { data: shiftOrders } = await ordersQuery

      // Calculate revenue per product based on orders in this shift
      const todaySalesMap = new Map<string, number>()
      if (shiftOrders) {
        for (const ord of shiftOrders) {
          const ordText = `${ord.actual_items || ''} ${ord.menu_items || ''}`
          const ordPrice = Number(ord.total_price) || 0
          for (const prod of prodsList) {
            if (
              ordText.includes(prod.name) ||
              (prod.aliases && prod.aliases.some((a: string) => ordText.includes(a)))
            ) {
              todaySalesMap.set(prod.name, (todaySalesMap.get(prod.name) || 0) + ordPrice)
            }
          }
        }
      }

      // 3. Parse depletion message
      const report = parseBatchDepletionMessage(rawMessage, prodsList, todaySalesMap)

      // 4. Execute stock deductions in parallel
      const updatePromises = report.items.map(async (item) => {
        if (!item.matchedProductId) return
        await Promise.all([
          supabaseAdmin
            .from('products')
            .update({
              stock_on_hand: item.newStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.matchedProductId),
          supabaseAdmin
            .from('inventory_transactions')
            .insert({
              product_id: item.matchedProductId,
              quantity: -Math.abs(item.quantity),
              reason: 'END_OF_DAY_DEPLETION',
              notes: `End of day batch depletion: ${item.quantity}${item.unit} (${item.costPerUnit > 0 ? `₪${item.costPerUnit}/u` : 'no cost set'})`
            })
        ])
      })

      await Promise.all(updatePromises)

      // 5. Invalidate cache
      invalidateDashboardCache()

      return NextResponse.json({
        success: true,
        report,
        telegramFormatted: formatDepletionTelegramReport(report)
      })
    }

    if (action === 'ASSIGN_ORDER_COURIER') {
      const { orderId, courierId } = body
      if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
      }

      // Check previous courier assignment first
      const { data: previousOrder } = await supabaseAdmin
        .from('crm_orders')
        .select(`
          id,
          courier_id,
          address,
          city,
          crm_couriers:courier_id (
            id,
            name,
            telegram_id
          )
        `)
        .eq('id', orderId)
        .maybeSingle()

      const oldCourierId = previousOrder?.courier_id || null
      const oldCourier: any = (previousOrder as any)?.crm_couriers
      const newCourierId = courierId || null

      if (oldCourierId === newCourierId) {
        // Nothing changed, avoid duplicate alerts
        return NextResponse.json({ success: true, message: 'No courier change' })
      }

      // 1. Update order in crm_orders and select full details
      const { data: updatedOrder, error: updateErr } = await supabaseAdmin
        .from('crm_orders')
        .update({ courier_id: newCourierId })
        .eq('id', orderId)
        .select(`
          id,
          address,
          city,
          menu_items,
          actual_items,
          total_price,
          courier_id,
          payment_method,
          is_prepaid,
          raw_message,
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

      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (botToken) {
        // A. Notify previous courier if reassigned away or unassigned
        if (oldCourier?.telegram_id && oldCourier.telegram_id !== assignedCourier?.telegram_id) {
          try {
            const revocationMsg = newCourierId
              ? `🔄 *הזמנה הועברה לשליח אחר*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${updatedOrder.address}
🏙️ *עיר:* ${updatedOrder.city || 'מרכז'}

המשלוח הועבר לטיפול שליח אחר — אין צורך לבצע אותו.`
              : `🚫 *ביטול שיבוץ משלוח*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${updatedOrder.address}
🏙️ *עיר:* ${updatedOrder.city || 'מרכז'}

השיבוץ בוטל במערכת — אין צורך לספק או לגבות.`

            await sendTelegramMessage(botToken, {
              chat_id: oldCourier.telegram_id,
              parse_mode: 'Markdown',
              text: revocationMsg
            })
          } catch (oldErr) {
            console.warn('[CRM API] Telegram revocation alert error:', oldErr)
          }
        }

        // B. Send instant Telegram dispatch notification to the NEW courier (strictly NO items!)
        if (assignedCourier?.telegram_id) {
          try {
            const payInfo = getOrderPaymentInfo(updatedOrder)
            const payIcon = payInfo.paymentMethod === 'ATM_CODE' ? '🏧' : payInfo.paymentMethod === 'CRYPTO' ? '🪙' : payInfo.paymentMethod === 'BIT' ? '📱' : '💳'
            const priceDisplay = payInfo.isPrepaid
              ? `0₪ מזומן (${payInfo.labelHe} ${payIcon})`
              : `₪${Number(updatedOrder.total_price || 0).toLocaleString()} מזומן`

            const prepaidWarning = payInfo.isPrepaid
              ? `\n${payIcon} *סטטוס תשלום:* ${payInfo.labelHe} — *אין לגבות מזומן מהלקוח!*`
              : ''

            const dispatchAlert = `🛵 *הזמנה חדשה שובצה עבורך!*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${updatedOrder.address}
🏙️ *עיר:* ${updatedOrder.city || 'מרכז'}
💵 *סכום לגבייה:* ${priceDisplay}${prepaidWarning}`

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

      // Determine active shift start for this courier (resets ONLY on Z-Report / day closeout)
      let shiftStartIso: string | null = null
      try {
        const { data: latestCloseout } = await supabaseAdmin
          .from('crm_day_closeouts')
          .select('shift_end, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (latestCloseout) {
          shiftStartIso = latestCloseout.shift_end || latestCloseout.created_at
        }
      } catch (e) {}

      let settleQuery = supabaseAdmin
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
        .eq('is_settled', false)

      if (shiftStartIso) {
        settleQuery = settleQuery.gt('order_date', shiftStartIso)
      }

      const { data: ordersToSettle } = await settleQuery

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

      // Active shift boundary: ONLY resets when a Z-Report (day closeout) is executed
      const shiftStart = latestCloseout
        ? (latestCloseout.shift_end || latestCloseout.created_at)
        : null

      const shiftEnd = new Date().toISOString()

      // 2. Fetch all orders belonging to this active shift
      let closeoutOrdersQuery = supabaseAdmin
        .from('crm_orders')
        .select(`
          id, total_price, courier_id, city, address, raw_message, is_settled, order_date, payment_method, is_prepaid,
          crm_customers:customer_id (address_name, city),
          crm_couriers(id, name, phone_number, telegram_id)
        `)
      
      if (shiftStart) {
        closeoutOrdersQuery = closeoutOrdersQuery.gt('order_date', shiftStart).lte('order_date', shiftEnd)
      } else {
        closeoutOrdersQuery = closeoutOrdersQuery.lte('order_date', shiftEnd).eq('is_settled', false)
      }

      const { data: shiftOrders } = await closeoutOrdersQuery

      const orders = shiftOrders || []
      const totalOrders = orders.length

      // 3. Compute detailed per-courier breakdown
      // Standard = ₪100, Bat Yam = ₪50
      const STANDARD_FEE = 100
      const BAT_YAM_FEE = 50

      // 3a. Fetch all recorded intermediate settlements in this active shift to respect actual reconciled courier pay & bonuses
      let settlementsQuery = supabaseAdmin
        .from('cash_settlements')
        .select('courier_id, courier_pay, bonus_amount, notes, gross_collected, amount_received, net_expected')
        .eq('status', 'SETTLED')

      if (shiftStart) {
        settlementsQuery = settlementsQuery.gt('created_at', shiftStart).lte('created_at', shiftEnd)
      } else {
        settlementsQuery = settlementsQuery.lte('created_at', shiftEnd)
      }

      const { data: shiftSettlements } = await settlementsQuery

      const settledPayByCourier = new Map<string, { totalPay: number; totalBonus: number; count: number }>()
      for (const s of shiftSettlements || []) {
        if (s.courier_id && !s.notes?.includes('סגירת יום רשמית')) {
          const prev = settledPayByCourier.get(s.courier_id) || { totalPay: 0, totalBonus: 0, count: 0 }
          settledPayByCourier.set(s.courier_id, {
            totalPay: prev.totalPay + (Number(s.courier_pay) || 0),
            totalBonus: prev.totalBonus + (Number(s.bonus_amount) || 0),
            count: prev.count + 1
          })
        }
      }

      const courierMap = new Map<string, {
        courier_id: string
        courier_name: string
        courier_phone?: string
        courier_telegram_id?: number | string | null
        orders_count: number
        gross_collected: number
        cash_collected: number
        bit_collected: number
        atm_code_collected?: number
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
            atm_code_collected: 0,
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
        const isAtmCode = payInfo.paymentMethod === 'ATM_CODE'
        const isBitCredit = payInfo.isPrepaid && !isAtmCode
        const physicalCash = payInfo.isPrepaid ? 0 : price

        entry.gross_collected += price
        entry.cash_collected += physicalCash
        if (isBitCredit) {
          entry.bit_collected += price
        }
        if (isAtmCode) {
          (entry as any).atm_code_collected = ((entry as any).atm_code_collected || 0) + price
        }

        const hasSettlements = settledPayByCourier.has(cId)
        if (cId !== 'unassigned') {
          // If courier already did intermediate settlements, ONLY calculate fee for newly added / unsettled orders!
          if (!hasSettlements || !o.is_settled) {
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
      }

      let totalGross = 0
      let totalPhysicalCash = 0
      let totalAtmCodeCash = 0
      let totalBitCredit = 0
      let totalCourierPay = 0
      let totalBonus = 0
      const courierBreakdown: any[] = []

      courierMap.forEach((entry: any) => {
        const settledInfo = settledPayByCourier.get(entry.courier_id)
        if (settledInfo) {
          entry.courier_fee += settledInfo.totalPay
          entry.bonus = settledInfo.totalBonus
        }
        // The courier only deposits physical cash in the safe!
        entry.net_to_safe = Math.max(0, entry.cash_collected - entry.courier_fee)
        totalGross += entry.gross_collected
        totalPhysicalCash += entry.cash_collected
        totalAtmCodeCash += (entry.atm_code_collected || 0)
        totalBitCredit += entry.bit_collected
        totalCourierPay += entry.courier_fee
        totalBonus += (entry.bonus || 0)
        courierBreakdown.push(entry)
      })

      const totalNetToSafe = Math.max(0, totalPhysicalCash - totalCourierPay)
      const creditProviderBalance = totalBitCredit
      const totalOverallBusinessProfit = totalNetToSafe + totalAtmCodeCash + creditProviderBalance

      // 4. Mark all orders up to shift end as settled
      await supabaseAdmin
        .from('crm_orders')
        .update({ is_settled: true })
        .lte('order_date', shiftEnd)

      // 4b. Deactivate all legacy courier customer assignments so couriers start fresh with a clean list
      try {
        await supabaseAdmin
          .from('customers')
          .update({ is_active: false, assigned_courier_id: null })
          .eq('is_active', true)
      } catch (custClearErr) {
        console.warn('[DashboardAPI] Note on deactivating courier customers on closeout:', custClearErr)
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
        total_atm_code_cash: totalAtmCodeCash,
        total_bit_credit: totalBitCredit,
        credit_provider_balance: creditProviderBalance,
        total_courier_pay: totalCourierPay,
        total_bonus: totalBonus,
        net_to_safe: totalNetToSafe,
        courier_breakdown: courierBreakdown,
        notes: notes ? `${notes} (רווח: ₪${totalOverallBusinessProfit.toLocaleString()})` : `סגירת יום מוצלחת (רווח: ₪${totalOverallBusinessProfit.toLocaleString()})`,
        closed_by: user.id,
        closed_by_name: user.user_metadata?.name || user.email || 'מנהל משמרת',
        created_at: shiftEnd
      }

      let { error: insertErr } = await supabaseAdmin
        .from('crm_day_closeouts')
        .insert(closeoutRecord)

      if (insertErr) {
        // Fallback if DB table has base schema without extra columns
        const { error: retryErr } = await supabaseAdmin
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
            courier_breakdown: courierBreakdown,
            notes: closeoutRecord.notes,
            closed_by: closeoutRecord.closed_by,
            closed_by_name: closeoutRecord.closed_by_name,
            created_at: closeoutRecord.created_at
          })
        if (retryErr) {
          console.error('[CRM API] CRITICAL: Failed to insert minimal closeout:', retryErr)
        }
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
          const atmNote = (c.atm_code_collected || 0) > 0 ? `  ▫️ שולם בקוד משיכה: ₪${c.atm_code_collected.toLocaleString()} (נמשך ע״י מחסנאי)\n` : ''
          return (
            `🛵 *${c.courier_name}* • ${c.orders_count} משלוחים${detailsStr ? ` ${detailsStr}` : ''}\n` +
            `  ▫️ גבייה ברוטו: ₪${c.gross_collected.toLocaleString()}\n` +
            bitNote +
            atmNote +
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
          const atmNote = (c.atm_code_collected || 0) > 0 ? `  ▫️ מתוכם בקוד משיכה: ₪${c.atm_code_collected.toLocaleString()} (אצל מחסנאי)\n` : ''
          return (
            `🛵 *${c.courier_name}* • ${c.orders_count} משלוחים\n` +
            `  ▫️ מחזור ברוטו: ₪${c.gross_collected.toLocaleString()}\n` +
            bitNote +
            atmNote +
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
        (totalAtmCodeCash > 0 ? `  ▫️ מזומן שנמשך בקוד כספומט (אצל מחסנאי): *₪${totalAtmCodeCash.toLocaleString()}*\n` : '') +
        `  ▫️ שולם מראש בביט / אשראי: *₪${totalBitCredit.toLocaleString()}*\n` +
        `▫️ סך עמלות שליחים ששולמו: *₪${totalCourierPay.toLocaleString()}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💵 *סך נטו מזומן ממעטפות שליחים:*\n` +
        `💰 *₪${totalNetToSafe.toLocaleString()}*\n` +
        (totalAtmCodeCash > 0 ? (
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `🏧 *מזומן שנמשך בקוד משיכה (אצל המחסנאי):*\n` +
          `💰 *₪${totalAtmCodeCash.toLocaleString()}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `🔒 *סה״כ מזומן פיזי בכספת (שליחים + מחסנאי):*\n` +
          `💰 *₪${(totalNetToSafe + totalAtmCodeCash).toLocaleString()}*\n`
        ) : '') +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 *יתרה אצל ספק אשראי / ביט (טרם נמשך):*\n` +
        `💳 *₪${totalBitCredit.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏦 *סה״כ רווח נקי כולל לעסק:*\n` +
        `💎 *₪${totalOverallBusinessProfit.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 *פירוט מעטפות מזומן לגבייה מכל שליח:*\n\n` +
        `${courierWarehouseCards}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        (notes && notes.trim() ? `📝 *הערות מנהל משמרת:*\n${notes.trim()}\n\n━━━━━━━━━━━━━━━━━━━━━\n` : '') +
        `🔒 *חובה על המחסנאי לוודא קבלת כל המעטפות במזומן והפקדת כל הכספים (כולל משיכות כספומט) בכספת.*`

      // Message 2: To Accounting Manager (Full Financial Audit Report)
      const accountantMessage =
        `📊 *דוח יומי פיננסי — הנהלת חשבונות | דוח Z*\n` +
        `📅 *תאריך:* ${closeDateFormatted} • *שעה:* ${closeTimeFormatted}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📈 *סיכום פיננסי יומי:*\n` +
        `▫️ סה״כ הזמנות שנמסרו: *${totalOrders}*\n` +
        `▫️ מחזור מכירות כולל: *₪${totalGross.toLocaleString()}*\n` +
        `  ▫️ תקבולים במזומן (שליחים): *₪${totalPhysicalCash.toLocaleString()}*\n` +
        (totalAtmCodeCash > 0 ? `  ▫️ תקבולים בקוד משיכה (מחסנאי): *₪${totalAtmCodeCash.toLocaleString()}*\n` : '') +
        `  ▫️ תקבולים בסליקה / ביט: *₪${totalBitCredit.toLocaleString()}*\n` +
        `▫️ הוצאות עמלות שליחים: *₪${totalCourierPay.toLocaleString()}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💵 *נטו מזומן ממעטפות שליחים:*\n` +
        `💰 *₪${totalNetToSafe.toLocaleString()}*\n` +
        (totalAtmCodeCash > 0 ? (
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `🏧 *מזומן שנמשך בקוד משיכה (אצל מחסנאי):*\n` +
          `💰 *₪${totalAtmCodeCash.toLocaleString()}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `🔒 *סה״כ מזומן פיזי בכספת:*\n` +
          `💰 *₪${(totalNetToSafe + totalAtmCodeCash).toLocaleString()}*\n`
        ) : '') +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 *יתרה לגבייה מספק אשראי / ביט:*\n` +
        `💳 *₪${totalBitCredit.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏦 *סה״כ רווח נקי כולל לעסק:*\n` +
        `💎 *₪${totalOverallBusinessProfit.toLocaleString()}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👥 *פירוט הכנסות ועמלות לפי שליח:*\n\n` +
        `${courierAccountantCards}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        (notes && notes.trim() ? `📝 *הערות מנהל:*\n${notes.trim()}\n\n━━━━━━━━━━━━━━━━━━━━━\n` : '') +
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
      const { name, category, unit, stock_on_hand, min_stock_alert, cost_per_unit, aliases } = body
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Product name is required.' }, { status: 400 })
      }

      const initialStock = Number(stock_on_hand) || 0
      const costPerUnitNum = Number(cost_per_unit) || 0
      const aliasArray = Array.isArray(aliases)
        ? aliases.map((a: string) => a.trim()).filter(Boolean)
        : typeof aliases === 'string'
        ? aliases.split(',').map((a: string) => a.trim()).filter(Boolean)
        : []

      const insertPayload: Record<string, any> = {
        name: name.trim(),
        category: (category || 'תפרחת').trim(),
        unit: unit === 'units' ? 'units' : 'g',
        stock_on_hand: initialStock,
        min_stock_alert: Number(min_stock_alert) || 10,
        aliases: aliasArray
      }

      let newProd: any = null
      const { data: createdWithCost, error: costErr } = await supabaseAdmin
        .from('products')
        .insert({ ...insertPayload, cost_per_unit: costPerUnitNum })
        .select()
        .single()

      if (costErr) {
        const { data: createdBase, error: baseErr } = await supabaseAdmin
          .from('products')
          .insert(insertPayload)
          .select()
          .single()
        if (baseErr) {
          return NextResponse.json({ error: baseErr.message }, { status: 400 })
        }
        newProd = createdBase
      } else {
        newProd = createdWithCost
      }

      saveLocalProductCost(newProd.id, costPerUnitNum)
      saveLocalProductCost(newProd.name, costPerUnitNum)

      if (initialStock > 0) {
        await supabaseAdmin.from('inventory_transactions').insert({
          product_id: newProd.id,
          quantity: initialStock,
          reason: 'INITIAL_STOCK',
          notes: `Initial warehouse catalog stock for ${newProd.name}`
        })
      }

      return NextResponse.json({
        success: true,
        product: { ...newProd, cost_per_unit: costPerUnitNum }
      })
    }

    if (action === 'UPDATE_PRODUCT') {
      const { productId, name, category, unit, min_stock_alert, cost_per_unit, aliases } = body
      if (!productId) {
        return NextResponse.json({ error: 'Missing productId' }, { status: 400 })
      }

      const costPerUnitNum = cost_per_unit !== undefined ? Number(cost_per_unit) || 0 : undefined
      if (costPerUnitNum !== undefined) {
        saveLocalProductCost(productId, costPerUnitNum)
        if (name) saveLocalProductCost(name.trim(), costPerUnitNum)
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
      if (costPerUnitNum !== undefined) updatePayload.cost_per_unit = costPerUnitNum

      let updatedProd: any = null
      const { data: updatedWithCost, error: updateErr } = await supabaseAdmin
        .from('products')
        .update(updatePayload)
        .eq('id', productId)
        .select()
        .single()

      if (updateErr) {
        const { cost_per_unit: _, ...fallbackPayload } = updatePayload
        const { data: fallbackUpdated, error: fallbackErr } = await supabaseAdmin
          .from('products')
          .update(fallbackPayload)
          .eq('id', productId)
          .select()
          .single()

        if (fallbackErr) {
          return NextResponse.json({ error: fallbackErr.message }, { status: 400 })
        }
        updatedProd = fallbackUpdated
      } else {
        updatedProd = updatedWithCost
      }

      const localCosts = getLocalProductCosts()
      const finalCost =
        costPerUnitNum !== undefined
          ? costPerUnitNum
          : localCosts[productId] ?? localCosts[updatedProd?.name] ?? 0

      return NextResponse.json({
        success: true,
        product: { ...updatedProd, cost_per_unit: finalCost }
      })
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

      // 4b. Deactivate from legacy customers table so courier screen immediately clears it
      try {
        if (order.address) {
          await supabaseAdmin
            .from('customers')
            .update({ is_active: false, assigned_courier_id: null })
            .eq('name', order.address)
        }
        if (order.customer_id) {
          const { data: crmCust } = await supabaseAdmin
            .from('crm_customers')
            .select('phone_number')
            .eq('id', order.customer_id)
            .maybeSingle()
          if (crmCust?.phone_number) {
            const cleanDigits = crmCust.phone_number.replace(/\D/g, '')
            if (cleanDigits.length >= 7) {
              await supabaseAdmin
                .from('customers')
                .update({ is_active: false, assigned_courier_id: null })
                .ilike('phone_number', `%${cleanDigits.slice(-7)}%`)
            }
          }
        }
      } catch (cDeactErr) {
        console.warn('[DELETE_ORDER] Note on deactivating customer:', cDeactErr)
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
      let newPaymentMethod = currentOrder.payment_method || 'CASH'
      let newIsPrepaid = currentOrder.is_prepaid === true

      // If rawMessage was edited, parse it and reconcile deductions!
      if (rawMessage && typeof rawMessage === 'string' && rawMessage.trim()) {
        const parsed = parseDeliveryMessage(rawMessage.trim())
        if (parsed.customerName) newAddress = parsed.customerName
        if (parsed.city) newCity = parsed.city
        if (parsed.menuItems) newMenuItems = parsed.menuItems
        if (parsed.actualItems) newActualItems = parsed.actualItems
        if (parsed.totalPrice > 0) newTotalPrice = parsed.totalPrice
        newPaymentMethod = parsed.paymentMethod
        newIsPrepaid = parsed.isPrepaid

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
        if (manualFields.paymentMethod !== undefined) {
          newPaymentMethod = manualFields.paymentMethod
          newIsPrepaid = manualFields.paymentMethod !== 'CASH'
        }
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
          raw_message: finalRawMessage,
          payment_method: newPaymentMethod,
          is_prepaid: newIsPrepaid
        })
        .eq('id', orderId)
        .select(`
          id, customer_id, brand_id, courier_id, address, city,
          menu_items, actual_items, total_price, is_settled,
          raw_message, order_date, created_at,
          payment_method, is_prepaid,
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
            const payIcon = payInfo.paymentMethod === 'CRYPTO' ? '🪙' : payInfo.paymentMethod === 'BIT' ? '📱' : '💳'
            const priceDisplay = payInfo.isPrepaid
              ? `0₪ מזומן (${payInfo.labelHe} ${payIcon})`
              : `₪${Number(updatedOrder.total_price || 0).toLocaleString()} מזומן`
            const prepaidWarning = payInfo.isPrepaid
              ? `\n${payIcon} *סטטוס תשלום:* ${payInfo.labelHe} — *אין לגבות מזומן מהלקוח!*`
              : ''

            // Notify new courier of new dispatch (strictly NO items!)
            if (courierObj?.telegram_id) {
              await sendTelegramMessage(botToken, {
                chat_id: courierObj.telegram_id,
                parse_mode: 'Markdown',
                text: `🛵 *הזמנה חדשה שובצה עבורך!*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${updatedOrder.address}
🏙️ *עיר:* ${updatedOrder.city || 'מרכז'}
💵 *סכום לגבייה:* ${priceDisplay}${prepaidWarning}`
              })
            }
          } else if (courierObj?.telegram_id) {
            // Case B: Same courier, check if price or address changed (couriers never see items)
            const priceChanged = Number(currentOrder.total_price) !== Number(updatedOrder.total_price)
            const addressChanged = currentOrder.address !== updatedOrder.address || currentOrder.city !== updatedOrder.city

            if (priceChanged || addressChanged) {
              const oldPriceNum = Number(currentOrder.total_price || 0)
              const newPriceNum = Number(updatedOrder.total_price || 0)
              const payInfo = getOrderPaymentInfo(updatedOrder)
              const payIcon = payInfo.paymentMethod === 'ATM_CODE' ? '🏧' : payInfo.paymentMethod === 'CRYPTO' ? '🪙' : payInfo.paymentMethod === 'BIT' ? '📱' : '💳'
              const priceDisplay = payInfo.isPrepaid
                ? `0₪ מזומן (${payInfo.labelHe} ${payIcon})`
                : `₪${newPriceNum.toLocaleString()} מזומן`
              const prepaidWarning = payInfo.isPrepaid
                ? `\n${payIcon} *הנחיה לשליח:* ${payInfo.labelHe} — *אין לגבות מזומן מהלקוח!*`
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
