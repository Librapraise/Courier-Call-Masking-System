import { NextRequest, NextResponse } from 'next/server'
import { parseDeliveryMessage, getOrderPaymentInfo } from '@/lib/crm/parser'
import { ingestParsedDelivery } from '@/lib/crm/ingestion-service'
import { sendTelegramMessage, formatBatchReceipt } from '@/lib/crm/telegram-bot'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getIsraelMidnightIso } from '@/lib/crm/date-utils'

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

        // Instant notification to warehouseman for ATM Cash Withdrawal Codes
        if (parsed.paymentMethod === 'ATM_CODE') {
          const warehouseTelegramIds = new Set<string>()
          const whEnv = (process.env.WAREHOUSE_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
          whEnv.forEach(id => warehouseTelegramIds.add(id))
          const adminEnv = (process.env.ALLOWED_TELEGRAM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
          adminEnv.forEach(id => warehouseTelegramIds.add(id))

          const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
          if (botToken && warehouseTelegramIds.size > 0) {
            const atmAlertText =
              `🏧 *התראת קוד משיכה מכספומט למחסנאי!*\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📍 *כתובת לקוח:* ${parsed.customerName}\n` +
              `🏙️ *עיר:* ${parsed.city}\n` +
              `💰 *סכום למשיכה:* *₪${parsed.totalPrice.toLocaleString()}*\n` +
              `📱 *טלפון:* \`${parsed.phoneNumber}\`\n` +
              (parsed.telegramHandle ? `👤 *טלגרם:* ${parsed.telegramHandle}\n` : '') +
              `🏷️ *מותג:* ${parsed.brand}\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `📝 *תוכן ההזמנה והקוד:*\n` +
              `${parsed.rawText}\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `⚡ *הנחיה למחסנאי:* יש למשוך את הכסף מהכספומט ולנעול בכספת.\n` +
              `🛵 *לשליח שובצה גבייה:* *0₪* (שולם בקוד).`

            for (const whId of warehouseTelegramIds) {
              try {
                await sendTelegramMessage(botToken, {
                  chat_id: whId,
                  parse_mode: 'Markdown',
                  text: atmAlertText
                })
              } catch (whErr) {
                console.warn('[TelegramWebhook] Error sending ATM code alert to warehouseman:', whErr)
              }
            }
          }
        }
      }
    }

    // 4. Calculate total courier cash collected in active shift (resets ONLY on Z-Report / day closeout)
    let totalCashToday = totalBatchCash
    try {
      // Find latest day closeout to determine the active shift start boundary (no midnight/36h expiration!)
      const { data: latestCloseout } = await supabaseAdmin
        .from('crm_day_closeouts')
        .select('shift_end, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const shiftStartIso = latestCloseout
        ? (latestCloseout.shift_end || latestCloseout.created_at)
        : null

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
