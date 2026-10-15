import { extractCityFromAddress } from './israeli-cities'
import { matchBrand, matchWarehouseProduct, MatchedWarehouseProduct } from './fuzzy-matcher'

export interface ParsedItemDeduction {
  menuName: string
  warehouseProductName: string
  quantity: number
  unit: string
  matchedProductCategory?: string
}

export type PaymentMethod = 'CASH' | 'BIT' | 'CREDIT' | 'PREPAID'

export interface ParsedDeliveryOrder {
  customerName: string       // Delivery address used as customer identity (e.g. "מרקו לויז - הנשיאים 57 פתח תקווה")
  city: string               // Extracted city (e.g. "פתח תקווה")
  phoneNumber: string        // Normalized Israeli phone (05XXXXXXXX)
  telegramHandle?: string    // @username
  customerType: string       // "קבוע", "חדש", "VIP"
  totalPrice: number         // Total order value (₪)
  paymentMethod: PaymentMethod // 'CASH' | 'BIT' | 'CREDIT' | 'PREPAID'
  isPrepaid: boolean         // True if customer paid via Bit / Credit / Prepaid
  cashToCollect: number      // Physical cash courier must collect (0 if prepaid)
  paymentLabel?: string      // Human-readable payment label (e.g. "שולם בביט")
  brand: string              // Matched from the 37 brands
  menuItems: string          // Original menu description
  actualItems: string        // Summary of actual warehouse deductions
  deductions: ParsedItemDeduction[] // Itemized deductions for inventory_transactions
  rawText: string
}

/**
 * Normalizes phone number to Israeli standard format: 05XXXXXXXX
 */
export function normalizePhoneNumber(raw: string): string | null {
  if (!raw) return null
  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, '')

  // Standard Israeli mobile is 10 digits starting with 05
  if (digits.length === 10 && digits.startsWith('05')) {
    return digits
  }

  // International format: 9725XXXXXXXX -> 05XXXXXXXX
  if (digits.length === 12 && digits.startsWith('9725')) {
    return '0' + digits.slice(3)
  }

  // 9 digits without leading 0: 5XXXXXXXX -> 05XXXXXXXX
  if (digits.length === 9 && digits.startsWith('5')) {
    return '0' + digits
  }

  return digits.length >= 9 ? digits : null
}

/**
 * Extracts price from text lines.
 * Examples: '3000₪ כולל משלוח', '750₪', '₪1,200', '1100 כולל משלוח'
 */
export function extractPrice(text: string): number {
  if (!text) return 0.0

  // Regex to capture price patterns: 3000₪, ₪1,200, 750 ₪, 1200 כולל משלוח
  const priceRegex = /(?:₪\s*([\d,]+)|([\d,]+)\s*(?:₪|ש"ח|שח|כולל משלוח))/i
  const match = text.match(priceRegex)

  if (match) {
    const rawVal = match[1] || match[2]
    const cleanNum = parseFloat(rawVal.replace(/,/g, ''))
    if (!isNaN(cleanNum)) return cleanNum
  }

  // Fallback: search for stand-alone numbers near currency keywords
  const fallbackRegex = /(\d[\d,]*)\s*(?:כולל משלוח)/i
  const fallbackMatch = text.match(fallbackRegex)
  if (fallbackMatch) {
    const cleanNum = parseFloat(fallbackMatch[1].replace(/,/g, ''))
    if (!isNaN(cleanNum)) return cleanNum
  }

  return 0.0
}

/**
 * Extracts payment method and prepaid status from text.
 * Detects: ביט, אשראי, שולם מראש, שולם בביט, 0₪, לגבות 0, etc.
 */
export function extractPaymentDetails(text: string, totalPrice: number): {
  paymentMethod: PaymentMethod
  isPrepaid: boolean
  cashToCollect: number
  paymentLabel: string
} {
  const lower = (text || '').toLowerCase()

  const hasBit =
    lower.includes('ביט') ||
    lower.includes('בביט') ||
    lower.includes('שולם בביט') ||
    lower.includes('שולם ביט') ||
    /\bbit\b/i.test(lower)

  const hasCredit =
    lower.includes('אשראי') ||
    lower.includes('באשראי') ||
    lower.includes('שולם באשראי') ||
    /\bcredit\b/i.test(lower)

  const hasPrepaid =
    hasBit ||
    hasCredit ||
    lower.includes('שולם מראש') ||
    lower.includes('שולם') ||
    lower.includes('prepaid') ||
    lower.includes('paid in advance') ||
    lower.includes('לגבות 0') ||
    lower.includes('לגבות: 0') ||
    lower.includes('0₪ לגבייה') ||
    lower.includes('0 לגבייה') ||
    lower.includes('0 לגביה') ||
    /(?:^|\s)0\s*(?:₪|ש"ח|שח)/.test(lower)

  if (hasBit) {
    return {
      paymentMethod: 'BIT',
      isPrepaid: true,
      cashToCollect: 0,
      paymentLabel: 'שולם בביט'
    }
  }

  if (hasCredit) {
    return {
      paymentMethod: 'CREDIT',
      isPrepaid: true,
      cashToCollect: 0,
      paymentLabel: 'שולם באשראי'
    }
  }

  if (hasPrepaid) {
    return {
      paymentMethod: 'PREPAID',
      isPrepaid: true,
      cashToCollect: 0,
      paymentLabel: 'שולם מראש'
    }
  }

  return {
    paymentMethod: 'CASH',
    isPrepaid: false,
    cashToCollect: totalPrice,
    paymentLabel: 'מזומן'
  }
}

/**
 * Universal helper to inspect any order object and determine payment method,
 * prepaid status, and cash to collect by the courier.
 */
export function getOrderPaymentInfo(order: {
  total_price?: number | string | null
  raw_message?: string | null
  notes?: string | null
  menu_items?: string | null
  payment_method?: string | null
  is_prepaid?: boolean | null
}): {
  isPrepaid: boolean
  paymentMethod: PaymentMethod
  cashToCollect: number
  totalPrice: number
  labelHe: string
  badgeText: string
} {
  const isPrepaidFlag =
    order.is_prepaid === true ||
    order.payment_method === 'BIT' ||
    order.payment_method === 'CREDIT' ||
    order.payment_method === 'PREPAID'

  const combined = [
    order.raw_message || '',
    order.notes || '',
    order.menu_items || '',
    order.payment_method || ''
  ].join(' ').toLowerCase()

  const hasBit =
    order.payment_method === 'BIT' ||
    combined.includes('ביט') ||
    combined.includes('בביט') ||
    combined.includes('שולם בביט') ||
    combined.includes('שולם ביט') ||
    /\bbit\b/i.test(combined)

  const hasCredit =
    order.payment_method === 'CREDIT' ||
    combined.includes('אשראי') ||
    combined.includes('באשראי') ||
    combined.includes('שולם באשראי') ||
    /\bcredit\b/i.test(combined)

  const hasPrepaid =
    isPrepaidFlag ||
    hasBit ||
    hasCredit ||
    order.payment_method === 'PREPAID' ||
    combined.includes('שולם מראש') ||
    combined.includes('שולם') ||
    combined.includes('prepaid') ||
    combined.includes('paid in advance') ||
    combined.includes('לגבות 0') ||
    combined.includes('לגבות: 0') ||
    combined.includes('0₪ לגבייה') ||
    combined.includes('0 לגבייה') ||
    combined.includes('0 לגביה') ||
    Number(order.total_price || 0) === 0

  const method: PaymentMethod = hasBit
    ? 'BIT'
    : hasCredit
    ? 'CREDIT'
    : hasPrepaid
    ? 'PREPAID'
    : 'CASH'

  const isPrepaid = hasPrepaid
  const totalPrice = Number(order.total_price || 0)
  const cashToCollect = isPrepaid ? 0 : totalPrice

  const labelHe = hasBit
    ? 'שולם בביט'
    : hasCredit
    ? 'שולם באשראי'
    : isPrepaid
    ? 'שולם מראש'
    : 'מזומן'

  const badgeText = hasBit
    ? '📱 ביט'
    : hasCredit
    ? '💳 אשראי'
    : isPrepaid
    ? '💳 שולם מראש'
    : '💵 מזומן'

  return {
    isPrepaid,
    paymentMethod: method,
    cashToCollect,
    totalPrice,
    labelHe,
    badgeText
  }
}

/**
 * Master parser for raw delivery messages received via Telegram.
 */
export function parseDeliveryMessage(rawText: string): ParsedDeliveryOrder {
  const cleanRaw = rawText.trim()
  const rawLines = cleanRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  let customerName = ''
  let city = ''
  let phoneNumber = ''
  let telegramHandle: string | undefined
  let customerType = 'קבוע'
  let totalPrice = 0.0
  let brand = 'כללי'
  const menuLines: string[] = []
  const deductions: ParsedItemDeduction[] = []

  // Check lines from bottom up to find Brand and Trailing Deductions
  let brandLineIndex = -1
  for (let i = rawLines.length - 1; i >= 0; i--) {
    const line = rawLines[i]
    const matched = matchBrand(line)
    if (matched) {
      brand = matched
      brandLineIndex = i
      break
    }
  }

  // If there are lines AFTER the brand line, they represent Trailing Warehouse Deductions
  // Example:
  // מלך הרפואי
  // 10 טריפ ציפ גדול
  const trailingDeductionLines: string[] = []
  if (brandLineIndex !== -1 && brandLineIndex < rawLines.length - 1) {
    for (let i = brandLineIndex + 1; i < rawLines.length; i++) {
      trailingDeductionLines.push(rawLines[i])
    }
  }

  // Parse lines above the brand line
  const upperLines = brandLineIndex !== -1 ? rawLines.slice(0, brandLineIndex) : rawLines

  for (let i = 0; i < upperLines.length; i++) {
    const line = upperLines[i]

    // 1. Check for Telegram handle: @username
    const tgMatch = line.match(/@([A-Za-z0-9_]+)/)
    if (tgMatch) {
      telegramHandle = '@' + tgMatch[1]
    }

    // 2. Check for Phone Number: 05X-XXXXXXX or 05XXXXXXXX
    const phoneRegex = /(?:05\d[\- ]?\d{3}[\- ]?\d{4}|05\d{8}|\+972[\- ]?5\d[\- ]?\d{7})/
    const phoneMatch = line.match(phoneRegex)
    if (phoneMatch && !phoneNumber) {
      const normalized = normalizePhoneNumber(phoneMatch[0])
      if (normalized) phoneNumber = normalized
    }

    // 3. Check for Customer Tier
    if (/לקוח קבוע|קבוע/i.test(line)) customerType = 'קבוע'
    else if (/לקוח חדש|חדש/i.test(line)) customerType = 'חדש'
    else if (/vip/i.test(line)) customerType = 'VIP'

    // 4. Check for Price
    const foundPrice = extractPrice(line)
    if (foundPrice > 0 && totalPrice === 0) {
      totalPrice = foundPrice
    }

    // 5. Line 1: In the vast majority of cases, Line 1 is the Customer Name / Address
    if (i === 0 && !customerName) {
      customerName = line
      const extracted = extractCityFromAddress(line)
      city = extracted.city
    }

    // 6. Check for "Slash" inventory rule: "Menu Item / Warehouse Deduction"
    // Example: "2 גלאטו 33/ 20 רפואי האני" or "2 אלסקה/ 20 רפואי מלון"
    if (line.includes('/')) {
      const slashParts = line.split('/')
      const menuPart = slashParts[0].trim()
      const warehousePart = slashParts.slice(1).join('/').trim()

      menuLines.push(menuPart)

      const matchedProd = matchWarehouseProduct(warehousePart)
      if (matchedProd) {
        deductions.push({
          menuName: menuPart,
          warehouseProductName: matchedProd.product.name,
          quantity: matchedProd.quantity,
          unit: matchedProd.unit,
          matchedProductCategory: matchedProd.product.category
        })
      } else {
        // Fallback deduction if name doesn't match catalog
        deductions.push({
          menuName: menuPart,
          warehouseProductName: warehousePart,
          quantity: 1,
          unit: 'g'
        })
      }
    } else {
      // Check if this line is an item line (not address, phone, price, handle, or tier)
      const isNotMeta = !line.match(phoneRegex) &&
        !line.match(/@([A-Za-z0-9_]+)/) &&
        !line.match(/(?:₪|ש"ח|כולל משלוח)/) &&
        !line.match(/לקוח קבוע|לקוח חדש/) &&
        line !== customerName

      if (isNotMeta) {
        menuLines.push(line)
      }
    }
  }

  // Process Trailing Deductions if found
  if (trailingDeductionLines.length > 0) {
    for (const trailLine of trailingDeductionLines) {
      const matchedProd = matchWarehouseProduct(trailLine)
      if (matchedProd) {
        deductions.push({
          menuName: menuLines.join(', ') || trailLine,
          warehouseProductName: matchedProd.product.name,
          quantity: matchedProd.quantity,
          unit: matchedProd.unit,
          matchedProductCategory: matchedProd.product.category
        })
      }
    }
  }

  // If no slash deductions and no trailing deductions, attempt to match products directly from item lines
  if (deductions.length === 0 && menuLines.length > 0) {
    for (const line of menuLines) {
      const matchedProd = matchWarehouseProduct(line)
      if (matchedProd) {
        deductions.push({
          menuName: line,
          warehouseProductName: matchedProd.product.name,
          quantity: matchedProd.quantity,
          unit: matchedProd.unit,
          matchedProductCategory: matchedProd.product.category
        })
      }
    }
  }

  // Fallback for customerName if missing
  if (!customerName && rawLines.length > 0) {
    customerName = rawLines[0]
    city = extractCityFromAddress(customerName).city
  }

  // Build readable summaries
  const menuItemsSummary = menuLines.length > 0 ? menuLines.join(', ') : 'הזמנה כללית'
  const actualItemsSummary = deductions.length > 0
    ? deductions.map(d => `${d.quantity}${d.unit === 'g' ? 'g' : ' יח׳'} ${d.warehouseProductName}`).join(', ')
    : menuItemsSummary

  // Determine payment method and cash to collect
  const paymentDetails = extractPaymentDetails(cleanRaw, totalPrice)

  return {
    customerName,
    city: city || 'אחר',
    phoneNumber,
    telegramHandle,
    customerType,
    totalPrice,
    paymentMethod: paymentDetails.paymentMethod,
    isPrepaid: paymentDetails.isPrepaid,
    cashToCollect: paymentDetails.cashToCollect,
    paymentLabel: paymentDetails.paymentLabel,
    brand,
    menuItems: menuItemsSummary,
    actualItems: actualItemsSummary,
    deductions,
    rawText
  }
}

export const parseSingleOrderMessage = parseDeliveryMessage
