/**
 * Telegram Bot API client and message formatting utilities.
 */

export interface TelegramSendMessageOptions {
  chat_id: number | string
  text: string
  parse_mode?: 'Markdown' | 'HTML'
  reply_markup?: any
}

export async function sendTelegramMessage(
  token: string,
  options: TelegramSendMessageOptions
): Promise<boolean> {
  if (!token) {
    console.warn('[TelegramBot] TELEGRAM_BOT_TOKEN is not configured.')
    return false
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })

    const data = await res.json()
    if (!data.ok) {
      console.error('[TelegramBot] Send message error:', data.description)
      return false
    }
    return true
  } catch (err: any) {
    console.error('[TelegramBot] Fetch error:', err.message)
    return false
  }
}

export interface IngestionBatchSummary {
  totalProcessed: number
  totalCashToday: number
  totalDeductions: { productName: string; quantity: number; unit: string }[]
  recentDeliveries: { address: string; brand: string; price: number }[]
  crmUrl?: string
}

/**
 * Formats a clean, high-impact Telegram receipt message in Hebrew.
 */
export function formatBatchReceipt(summary: IngestionBatchSummary): string {
  const defaultBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.couriercall.site').replace(/\/+$/, '')
  const crmLink = summary.crmUrl || `${defaultBase}/crm`

  // 100% Sterile Stealth Response — No strain names, addresses, or flagged keywords sent over Telegram Bot API!
  return (
    `⚡ *הסנכרון הושלם בהצלחה*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📥 *נקלטו למערכת:* ${summary.totalProcessed} פריטים\n` +
    `🕒 *שעה:* ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔗 [פתח את הדשבורד לצפייה מלאה ומאובטחת](${crmLink})`
  )
}
