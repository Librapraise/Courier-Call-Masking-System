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
  const crmLink = summary.crmUrl || 'https://www.couriercall.site/crm'

  let msg = `✅ *נקלטו ${summary.totalProcessed} משלוחים בהצלחה בסיארם!*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  msg += `💰 *קופת שליחים שנצברה:* ₪${summary.totalCashToday.toLocaleString()}\n\n`

  if (summary.totalDeductions.length > 0) {
    msg += `📦 *מלאי שירד מהמחסן:*\n`
    for (const d of summary.totalDeductions) {
      msg += `  • ${d.quantity}${d.unit === 'g' ? 'g' : ' יח׳'} *${d.productName}*\n`
    }
    msg += `\n`
  }

  if (summary.recentDeliveries.length > 0) {
    msg += `📍 *משלוחים אחרונים שנקלטו:*\n`
    const previewList = summary.recentDeliveries.slice(0, 5)
    for (const d of previewList) {
      msg += `  • ${d.address} | ₪${d.price} (${d.brand})\n`
    }
    if (summary.recentDeliveries.length > 5) {
      msg += `  _ועוד ${summary.recentDeliveries.length - 5} משלוחים..._\n`
    }
    msg += `\n`
  }

  msg += `🔗 [פתח את ה-CRM לצפייה ופילוח](${crmLink})`

  return msg
}
