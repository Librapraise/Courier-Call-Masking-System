import { NextRequest, NextResponse } from 'next/server'
import { parseDeliveryMessage, getOrderPaymentInfo } from '@/lib/crm/parser'
import { ingestParsedDelivery } from '@/lib/crm/ingestion-service'
import { sendTelegramMessage, formatBatchReceipt } from '@/lib/crm/telegram-bot'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getIsraelMidnightIso } from '@/lib/crm/date-utils'
import { getLocalProductCosts } from '@/lib/crm/product-costs'
import { parseBatchDepletionMessage, formatDepletionTelegramReport } from '@/lib/crm/depletion-parser'
import { invalidateDashboardCache } from '@/lib/crm/cache'

// In-memory cache for dynamic admin Telegram IDs to prevent slow listUsers calls on every webhook hit
let cachedDynamicAdminIds: Set<string> = new Set()
let cachedDynamicAdminIdsExpiresAt = 0

async function getDynamicAdminTelegramIds(): Promise<Set<string>> {
  const now = Date.now()
  if (cachedDynamicAdminIdsExpiresAt > now) {
    return cachedDynamicAdminIds
  }
  try {
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
    const newSet = new Set<string>()
    if (usersData?.users) {
      usersData.users.forEach(u => {
        const tid = u.user_metadata?.telegram_id?.toString()
        if (tid) newSet.add(tid)
      })
    }
    cachedDynamicAdminIds = newSet
    cachedDynamicAdminIdsExpiresAt = now + 5 * 60 * 1000 // Cache for 5 minutes
    return newSet
  } catch (err) {
    console.warn('[TelegramWebhook] Error refreshing dynamic admin cache:', err)
    return cachedDynamicAdminIds
  }
}

// In-memory cache for active shift start boundary (60 seconds TTL)
let cachedShiftStart: { iso: string | null; expiresAt: number } | null = null

async function getShiftStartIso(): Promise<string | null> {
  const now = Date.now()
  if (cachedShiftStart && cachedShiftStart.expiresAt > now) {
    return cachedShiftStart.iso
  }
  const { data: latestCloseout } = await supabaseAdmin
    .from('crm_day_closeouts')
    .select('shift_end, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const iso = latestCloseout
    ? (latestCloseout.shift_end || latestCloseout.created_at)
    : null

  cachedShiftStart = { iso, expiresAt: now + 60000 }
  return iso
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 1. Verify update contains message
    const message = body.message || body.channel_post || body.edited_message
    if (!message) {
      return NextResponse.json({ ok: true, status: 'ignored_no_message' })
    }

    const senderId = message.from?.id ? String(message.from.id) : null
    const chatId = message.chat?.id
    const messageText: string = message.text || message.caption || ''

    if (!messageText.trim()) {
      return NextResponse.json({ ok: true, status: 'ignored_empty_text' })
    }

    // 1b. Secret Token Verification (Optional standard Telegram Bot API security header)
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
    if (webhookSecret && incomingSecret !== webhookSecret) {
      console.warn('[TelegramWebhook] Invalid or missing secret token header')
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Whitelist Verification (OPSEC Guard)
    const allowedIdsEnv = process.env.ALLOWED_TELEGRAM_ADMIN_IDS || ''
    const allowedIds = allowedIdsEnv.split(',').map(s => s.trim()).filter(Boolean)

    let isAuthorized = allowedIds.length === 0 || (senderId ? allowedIds.includes(senderId) : false)

    // Dynamic database check: also accept Telegram IDs saved in admin user profiles (with 5-minute memory cache)
    if (!isAuthorized && senderId) {
      const dynamicIds = await getDynamicAdminTelegramIds()
      if (dynamicIds.has(senderId.toString())) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      console.warn(`[TelegramWebhook] Unauthorized access attempt from sender ID: ${senderId || 'unknown'}`)
      // Silently return 200 to avoid probing / scanning feedback
      return NextResponse.json({ ok: true, status: 'unauthorized_dropped' })
    }

    // Handle commands like /start or /help
    if (messageText.startsWith('/start') || messageText.startsWith('/help')) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
      if (botToken && chatId) {
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.couriercall.site').replace(/\/+$/, '')
        await sendTelegramMessage(botToken, {
          chat_id: chatId,
          parse_mode: 'Markdown',
          text: `👋 *שלום וברוכים הבאים ל-Persian Team Management Bot*\n\nכדי להזין משלוחים לסיארם:\n1. פשוט סמן את כל הודעות המשלוח והעבר (Forward) אותן לכאן.\n2. הבוט יעדכן אוטומטית את מאגר הלקוחות, יחשב את קופת השליחים, ויוריד את המלאי מהמחסן.\n\n🔗 [פתח את ה-CRM](${appUrl}/crm)`
        })
      }
      return NextResponse.json({ ok: true, status: 'command_handled' })
    }

    // Handle End-of-Day Batch Inventory Depletion (e.g. "להוריד מהמלאי")
    if (
      messageText.trim().startsWith('להוריד מהמלאי') ||
      messageText.trim().startsWith('פריקת מלאי') ||
      messageText.trim().startsWith('סגירת מלאי')
    ) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
      const activeCosts = getLocalProductCosts()

      const { data: prodsData } = await supabaseAdmin
        .from('products')
        .select('id, name, category, unit, stock_on_hand, min_stock_alert, aliases')

      const prodsList = (prodsData || []).map((p: any) => ({
        ...p,
        cost_per_unit: Number(activeCosts[p.id] ?? activeCosts[p.name] ?? p.cost_per_unit ?? 0)
      }))

      // Today's orders for revenue attribution
      const shiftStartIso = await getShiftStartIso()
      let ordersQuery = supabaseAdmin
        .from('crm_orders')
        .select('id, total_price, menu_items, actual_items, order_date')

      if (shiftStartIso) {
        ordersQuery = ordersQuery.gt('order_date', shiftStartIso)
      }

      const { data: shiftOrders } = await ordersQuery
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

      const report = parseBatchDepletionMessage(messageText, prodsList, todaySalesMap)

      // Execute deductions in parallel
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
              notes: `Telegram batch depletion: ${item.quantity}${item.unit} (${item.costPerUnit > 0 ? `₪${item.costPerUnit}/u` : 'no cost set'})`
            })
        ])
      })

      await Promise.all(updatePromises)
      invalidateDashboardCache()

      if (botToken && chatId) {
        const reportText = formatDepletionTelegramReport(report)
        await sendTelegramMessage(botToken, {
          chat_id: chatId,
          parse_mode: 'Markdown',
          text: reportText
        })
      }

      return NextResponse.json({
        ok: true,
        type: 'batch_depletion_handled',
        depletedCount: report.items.length,
        totalCost: report.totalCostOfGoods,
        totalRevenue: report.totalRevenueToday
      })
    }

    // 3. Process delivery message (Supports single or batch forwarded text in parallel)
    const rawBlocks = messageText.includes('---') 
      ? messageText.split('---') 
      : [messageText]

    const validBlocks = rawBlocks.map(b => b.trim()).filter(b => b.length >= 10)

    // Process all forwarded orders concurrently in parallel for lightning-fast ingestion
    const ingestResults = await Promise.all(
      validBlocks.map(async (cleanBlock) => {
        const parsed = parseDeliveryMessage(cleanBlock)
        if (!parsed.phoneNumber || !parsed.customerName) return null
        const result = await ingestParsedDelivery(parsed)
        return { parsed, result }
      })
    )

    let processedCount = 0
    let totalBatchCash = 0
    const allDeductions: { productName: string; quantity: number; unit: string }[] = []
    const recentDeliveries: { address: string; brand: string; price: number }[] = []

    for (const item of ingestResults) {
      if (!item) continue
      const { parsed, result } = item
      if (result.success && result.orderSummary) {
        processedCount++
        totalBatchCash += result.orderSummary.price
        recentDeliveries.push({
          address: result.orderSummary.address,
          brand: result.orderSummary.brand,
          price: result.orderSummary.price
        })

        for (const d of result.orderSummary.deductions) {
          const existing = allDeductions.find(x => x.productName === d.productName)
          if (existing) {
            existing.quantity += d.quantity
          } else {
            allDeductions.push({ ...d })
          }
        }

        // Instant notification strictly to WAREHOUSEMAN for ATM Cash Withdrawal Codes
        if (parsed.paymentMethod === 'ATM_CODE') {
          const warehouseTelegramIds = new Set<string>()
          const whEnv = (process.env.WAREHOUSE_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
          whEnv.forEach(id => warehouseTelegramIds.add(id))

          try {
            // Also fetch any database profiles / auth users explicitly assigned the 'warehouseman' role
            const { data: whProfiles } = await supabaseAdmin
              .from('profiles')
              .select('id, phone_number, role')
              .eq('role', 'warehouseman')

            const { data: crmRoster } = await supabaseAdmin
              .from('crm_couriers')
              .select('phone_number, telegram_id, name')

            const { data: authUsersList } = await supabaseAdmin.auth.admin.listUsers()

            for (const u of authUsersList?.users || []) {
              if (u.user_metadata?.role === 'warehouseman' && u.user_metadata?.telegram_id) {
                warehouseTelegramIds.add(String(u.user_metadata.telegram_id).trim())
              }
            }

            for (const wp of whProfiles || []) {
              const cleanPhone = (wp.phone_number || '').replace(/\D/g, '')
              const matched = (crmRoster || []).find(r => (r.phone_number || '').replace(/\D/g, '').endsWith(cleanPhone.slice(-9)))
              if (matched?.telegram_id) warehouseTelegramIds.add(String(matched.telegram_id).trim())
            }
          } catch (dbErr) {
            console.warn('[TelegramWebhook] Error fetching warehouse profiles:', dbErr)
          }

          const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
          if (botToken && warehouseTelegramIds.size > 0) {
            const defaultBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.couriercall.site').replace(/\/+$/, '')
            const atmAlertText =
              `🏧 *התראת קוד משיכה מכספומט למחסנאי!*\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `💰 *סכום למשיכה:* *₪${parsed.totalPrice.toLocaleString()}*\n` +
              `🏙️ *עיר:* ${parsed.city}\n` +
              (parsed.paymentLabel ? `🏷️ *הערת תשלום:* ${parsed.paymentLabel}\n` : '') +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `⚡ *הנחיה למחסנאי:* יש למשוך את הכסף מהכספומט ולנעול בכספת.\n` +
              `🛵 *לשליח שובצה גבייה:* *0₪* (שולם בקוד).\n` +
              `🔗 [לצפייה בפרטי ההזמנה בדשבורד](${defaultBase}/crm)`

            // Send concurrent alerts strictly to registered warehouse managers
            Promise.allSettled(
              Array.from(warehouseTelegramIds).map(whId =>
                sendTelegramMessage(botToken, {
                  chat_id: whId,
                  parse_mode: 'Markdown',
                  text: atmAlertText
                })
              )
            ).catch(whErr => {
              console.warn('[TelegramWebhook] Error sending ATM code alert to warehouseman:', whErr)
            })
          }
        }
      }
    }

    // 4. Calculate total courier cash collected in active shift (cached shift boundary)
    let totalCashToday = totalBatchCash
    try {
      const shiftStartIso = await getShiftStartIso()

      let query = supabaseAdmin
        .from('crm_orders')
        .select('total_price, payment_method, is_prepaid, is_settled, order_date')
        .eq('is_settled', false)

      if (shiftStartIso) {
        query = query.gt('order_date', shiftStartIso)
      }

      // Only count unsettled physical cash orders currently in couriers' hands
      const { data: activeOrders } = await query

      if (activeOrders && activeOrders.length > 0) {
        totalCashToday = activeOrders.reduce((sum, o) => {
          const payInfo = getOrderPaymentInfo(o)
          return sum + (payInfo.isPrepaid ? 0 : payInfo.cashToCollect)
        }, 0)
      } else {
        totalCashToday = totalBatchCash
      }
    } catch (e) {
      console.warn('[TelegramWebhook] Could not aggregate active shift orders:', e)
    }

    // 5. Send Receipt Confirmation back to dispatcher on Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
    if (botToken && chatId && processedCount > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.couriercall.site'
      const receiptText = formatBatchReceipt({
        totalProcessed: processedCount,
        totalCashToday,
        totalDeductions: allDeductions,
        recentDeliveries,
        crmUrl: `${appUrl}/crm`
      })

      await sendTelegramMessage(botToken, {
        chat_id: chatId,
        parse_mode: 'Markdown',
        text: receiptText
      })
    }

    return NextResponse.json({
      ok: true,
      processed: processedCount,
      totalBatchCash,
      deductionsCount: allDeductions.length
    })
  } catch (err: any) {
    console.error('[TelegramWebhook] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'Persian Team Management Telegram Ingestion Webhook',
    timestamp: new Date().toISOString()
  })
}
