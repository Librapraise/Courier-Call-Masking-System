import { NextRequest, NextResponse } from 'next/server'
import { parseDeliveryMessage } from '@/lib/crm/parser'
import { ingestParsedDelivery } from '@/lib/crm/ingestion-service'
import { sendTelegramMessage, formatBatchReceipt } from '@/lib/crm/telegram-bot'
import { supabaseAdmin } from '@/lib/supabase/server'

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

    // Dynamic database check: also accept Telegram IDs saved in admin user profiles
    if (!isAuthorized && senderId) {
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
        if (usersData?.users) {
          const dbAllowed = usersData.users.some(
            u => u.user_metadata?.telegram_id?.toString() === senderId.toString()
          )
          if (dbAllowed) {
            isAuthorized = true
          }
        }
      } catch (err) {
        console.warn('[TelegramWebhook] Error checking database whitelist:', err)
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
        await sendTelegramMessage(botToken, {
          chat_id: chatId,
          parse_mode: 'Markdown',
          text: `👋 *שלום וברוכים הבאים ל-Persian Team Management Bot*\n\nכדי להזין משלוחים לסיארם:\n1. פשוט סמן את כל הודעות המשלוח והעבר (Forward) אותן לכאן.\n2. הבוט יעדכן אוטומטית את מאגר הלקוחות, יחשב את קופת השליחים, ויוריד את המלאי מהמחסן.\n\n🔗 [פתח את ה-CRM](https://www.couriercall.site/crm)`
        })
      }
      return NextResponse.json({ ok: true, status: 'command_handled' })
    }

    // 3. Process delivery message (Supports single or batch forwarded text)
    // Sometimes dispatchers forward a block of text containing multiple dispatches separated by blank lines or headers
    const rawBlocks = messageText.includes('---') 
      ? messageText.split('---') 
      : [messageText]

    let processedCount = 0
    let totalBatchCash = 0
    const allDeductions: { productName: string; quantity: number; unit: string }[] = []
    const recentDeliveries: { address: string; brand: string; price: number }[] = []

    for (const block of rawBlocks) {
      const cleanBlock = block.trim()
      if (cleanBlock.length < 10) continue

      const parsed = parseDeliveryMessage(cleanBlock)

      // Only ingest if it has minimum required fields: phone number and customer name
      if (parsed.phoneNumber && parsed.customerName) {
        const result = await ingestParsedDelivery(parsed)
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
        }
      }
    }

    // 4. Calculate total courier cash collected today across all orders
    let totalCashToday = totalBatchCash
    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data: todayOrders } = await supabaseAdmin
        .from('crm_orders')
        .select('total_price')
        .gte('order_date', todayStart.toISOString())

      if (todayOrders && todayOrders.length > 0) {
        totalCashToday = todayOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
      }
    } catch (e) {
      console.warn('[TelegramWebhook] Could not aggregate today orders:', e)
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
