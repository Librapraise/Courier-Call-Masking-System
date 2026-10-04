import { NextResponse } from 'next/server'
import { supabaseAdmin, createClient } from '@/lib/supabase/server'
import { BRANDS_LIST } from '@/lib/crm/catalog-data'
import { sendTelegramMessage } from '@/lib/crm/telegram-bot'
import { formatPhoneForStorage } from '@/lib/utils/phone'

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

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required.' }, { status: 403 })
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

    // 5. Calculate Top Metrics
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    const allOrders = orders || []
    const todayOrders = allOrders.filter(o => o.order_date >= todayIso)
    const courierCashToday = todayOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
    const totalDeliveriesToday = todayOrders.length

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

    // Compute courier totals
    const courierSummaryMap: Record<string, { totalCash: number; count: number; settled: boolean }> = {}
    todayOrders.forEach(o => {
      const cId = (o as any).crm_couriers?.id || 'unknown'
      if (!courierSummaryMap[cId]) {
        courierSummaryMap[cId] = { totalCash: 0, count: 0, settled: true }
      }
      courierSummaryMap[cId].totalCash += Number(o.total_price) || 0
      courierSummaryMap[cId].count += 1
      if (!o.is_settled) {
        courierSummaryMap[cId].settled = false
      }
    })

    const couriers = (couriersData || []).map(c => {
      const summary = courierSummaryMap[c.id] || { totalCash: 0, count: 0, settled: false }
      const hasOrdersToday = summary.count > 0
      return {
        ...c,
        todayCash: summary.totalCash,
        todayOrders: summary.count,
        isSettledToday: hasOrdersToday ? summary.settled : false,
        shiftStatus: !hasOrdersToday ? 'no_shift' : summary.settled ? 'reconciled' : 'open'
      }
    })

    return NextResponse.json({
      metrics: {
        courierCashToday,
        totalDeliveriesToday,
        activeCustomers: customerCount || allOrders.length,
        lowStockAlerts: lowStockCount
      },
      orders: allOrders,
      brands,
      products: products || [],
      couriers,
      customers: customersData || [],
      cityCounts
    })
  } catch (err: any) {
    console.error('[CRM API] Unexpected error in GET:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // 0. Verify Auth Session & Admin Privilege
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required.' }, { status: 403 })
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
            const dispatchAlert = `🛵 *הזמנה חדשה שובצה עבורך!*
━━━━━━━━━━━━━━━━━━━━━
📍 *כתובת:* ${updatedOrder.address}
🏙️ *עיר:* ${updatedOrder.city || 'מרכז'}
💵 *סכום לגבייה:* ₪${Number(updatedOrder.total_price || 0).toLocaleString()} מזומן`

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
      const { courierId, amountReceived, notes } = body
      if (!courierId) {
        return NextResponse.json({ error: 'Missing courierId' }, { status: 400 })
      }

      // Mark today's orders for this courier as settled
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayIso = today.toISOString()

      const { data: ordersToSettle } = await supabaseAdmin
        .from('crm_orders')
        .select('id, total_price')
        .eq('courier_id', courierId)
        .gte('order_date', todayIso)
        .eq('is_settled', false)

      const totalExpected = (ordersToSettle || []).reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)

      await supabaseAdmin
        .from('crm_orders')
        .update({ is_settled: true })
        .eq('courier_id', courierId)
        .gte('order_date', todayIso)

      // Record in cash_settlements
      await supabaseAdmin
        .from('cash_settlements')
        .insert({
          courier_id: courierId,
          total_collected: totalExpected,
          amount_received: amountReceived ?? totalExpected,
          status: 'SETTLED',
          notes: notes || 'Settled via Persian Team Management Dashboard'
        })

      return NextResponse.json({ success: true, settledOrders: (ordersToSettle || []).length })
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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[CRM API] Unexpected error in POST:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
