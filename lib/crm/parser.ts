import { extractCityFromAddress } from './israeli-cities'
import { matchBrand, matchWarehouseProduct, MatchedWarehouseProduct, normalizeHebrewText } from './fuzzy-matcher'

export interface ParsedItemDeduction {
  menuName: string
  warehouseProductName: string
  quantity: number
  unit: string
  matchedProductCategory?: string
}

export type PaymentMethod = 'CASH' | 'BIT' | 'CRYPTO' | 'CREDIT' | 'PREPAID' | 'ATM_CODE'

export interface ParsedDeliveryOrder {
  customerName: string       // Delivery address used as customer identity (e.g. "מרקו לויז - הנשיאים 57 פתח תקווה")
  city: string               // Extracted city (e.g. "פתח תקווה")
  phoneNumber: string        // Normalized Israeli phone (05XXXXXXXX)
  telegramHandle?: string    // @username
  customerType: string       // "קבוע", "חדש", "VIP"
  totalPrice: number         // Total order value (₪)
  paymentMethod: PaymentMethod // 'CASH' | 'BIT' | 'CRYPTO' | 'CREDIT' | 'PREPAID'
  isPrepaid: boolean         // True if customer paid via Bit / Crypto / Credit / Prepaid
  cashToCollect: number      // Physical cash courier must collect (0 if prepaid)
  paymentLabel?: string      // Human-readable payment label (e.g. "שולם בקריפטו", "שולם בביט")
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

function parsePriceNumber(rawVal: string): number {
  if (!rawVal) return 0
  let cleaned = rawVal.trim()
  // Check if formatted like 1.100 or 2.500 (1-3 digits, dot, exactly 3 digits) -> thousands separator
  if (/^\d{1,3}\.\d{3}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '')
  } else {
    // Normal comma removal e.g. 1,100 -> 1100
    cleaned = cleaned.replace(/,/g, '')
  }
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Strips currency tokens, prices, and keywords from a line of text.
 * Used when price is embedded on an item line (e.g. "2 קוק 1,100₪" -> "2 קוק").
 */
export function stripPriceFromText(line: string): string {
  if (!line) return ''
  return line
    .replace(/(?:(?:₪|ש"?ח|nis|ils)\s*[0-9][0-9,.]*|[0-9][0-9,.]*\s*(?:₪|ש"?ח|nis|ils))/gi, ' ')
    .replace(/(?:סכום(?:\s*לגב(?:יי)?ה)?|מחיר|לתשלום|לגבות|סה"?כ)\s*[:=\-]?\s*[0-9][0-9,.]*/gi, ' ')
    .replace(/(?:[0-9][0-9,.]*\s*כולל משלוח|כולל משלוח\s*[0-9][0-9,.]*|כולל משלוח)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extracts price from text lines or whole messages.
 * Robust across all Israeli price patterns:
 * - 500₪, 500 ₪, ₪500, ₪ 500
 * - 1,100₪, 1,100 ₪, ₪1,100, ₪ 1,100, 1.100₪
 * - 500 ש"ח, 500 שח, ש"ח 500, שח 500
 * - 500 NIS, 500 nis, NIS 500, nis 500, 500 ILS, 500ils
 * - 1200 כולל משלוח, כולל משלוח 1200
 * - סכום: 1100, מחיר: 1100, לגבות: 1100, לתשלום: 1100, סה"כ: 1100
 */
export function extractPrice(text: string): number {
  if (!text) return 0.0

  // 1. Explicit currency symbol (₪, ש"ח, שח, NIS, ILS) - Left or Right
  // Group 1 (prefix): ₪1100, ₪ 1,100, ש"ח 500, NIS 500
  // Group 2 (suffix): 1100₪, 1,100 ₪, 500 ש"ח, 500 שח, 500 NIS, 500 nis, 500ils
  const currencyRegex = /(?:(?:₪|ש"?ח|nis|ils)\s*([0-9][0-9,.]*)|([0-9][0-9,.]*)\s*(?:₪|ש"?ח|nis|ils))/gi

  let match: RegExpExecArray | null
  while ((match = currencyRegex.exec(text)) !== null) {
    const rawVal = match[1] || match[2]
    if (rawVal) {
      const num = parsePriceNumber(rawVal)
      if (num > 0) return num
    }
  }

  // 2. Explicit keywords: סכום לגבייה, סכום, מחיר, לתשלום, לגבות, סה"כ
  const keywordRegex = /(?:סכום(?:\s*לגב(?:יי)?ה)?|מחיר|לתשלום|לגבות|סה"?כ)\s*[:=\-]?\s*([0-9][0-9,.]*)/i
  const kwMatch = text.match(keywordRegex)
  if (kwMatch && kwMatch[1]) {
    const num = parsePriceNumber(kwMatch[1])
    if (num > 0) return num
  }

  // 3. Fallback: "כולל משלוח" (e.g. 1200 כולל משלוח or כולל משלוח 1200)
  const shippingRegex = /(?:([0-9][0-9,.]*)\s*כולל משלוח|כולל משלוח\s*([0-9][0-9,.]*))/i
  const shipMatch = text.match(shippingRegex)
  if (shipMatch) {
    const rawVal = shipMatch[1] || shipMatch[2]
    if (rawVal) {
      const num = parsePriceNumber(rawVal)
      if (num > 0) return num
    }
  }

  return 0.0
}

// Common payment verb roots in Hebrew: משלם, משלמת, משלמים, שולם, שולמו, שילם, שילמה, שילמו, תשלום, הועבר, הועברו, העברה, סליקה, שלח, שולח
export const HE_PAY_VERBS = '(?:משל[םמ](?:ת|ים)?|שול[םמ](?:ו)?|שיל[םמ](?:ה|ו)?|תשלום|הועבר(?:ו)?|העברה|סליק(?:ה|ת)?|ש[לו]לח)'

// ATM Cash Withdrawal Code ("קוד משיכה" / "בקוד משיכה" / "משלם בקוד" / "שילם בקוד" / "כספומט" / "במשיכה")
export const ATM_CODE_REGEX = new RegExp(
  `(?:` +
    `(?:ב?קוד\\s*(?:ל?משיכה|כספומט|ללא\\s*כרטיס)|ב?משיכה\\s*ללא\\s*כרטיס|ב?כספומט)` +
    `|${HE_PAY_VERBS}\\s+(?:ב?קוד(?:\\s*משיכה|\\s*כספומט)?|ב?משיכה|ב?כספומט)` +
    `|(?:^|[^\\u0590-\\u05FFa-z0-9])(?:ב?קוד\\s*משיכה|במשיכה|בקוד\\s*כספומט)(?:$|[^\\u0590-\\u05FFa-z0-9])` +
    `|(?:^|[^\\u0590-\\u05FFa-z0-9])בקוד(?:\\s*:\\s*\\d+|\\s+\\d+)(?:$|[^\\u0590-\\u05FFa-z0-9])` +
    `|\\b(?:(?:in\\s+)?withdrawal\\s*code|(?:in\\s+)?atm\\s*code|cardless\\s*withdrawal|(?:paid|pay|paying|payer)\\s+(?:via|with|by|in)?\\s*atm)\\b` +
  `)`,
  'i'
)

// Crypto & Wallet ("קריפטו" / "בקריפטו" / "בארנק" / "לארנק" / "ארנק" / "ביטקוין" / "USDT")
export const CRYPTO_REGEX = new RegExp(
  `(?:` +
    `${HE_PAY_VERBS}\\s+(?:ב?קריפטו|ב?ארנק|ל?ארנק|ב?ביטקוין|ב?usdt|ב?btc|ב?eth)` +
    `|(?:^|[^\\u0590-\\u05FFa-z0-9])ב?קריפטו(?:$|[^\\u0590-\\u05FFa-z0-9])` +
    `|(?:^|[^\\u0590-\\u05FFa-z0-9])(?:ב?ארנק(?:\\s+קריפטו|\\s+דיגיטלי)?|לארנק(?:\\s+קריפטו|\\s+דיגיטלי)?)(?:$|[^\\u0590-\\u05FFa-z0-9])` +
    `|(?:^|[^\\u0590-\\u05FFa-z0-9])(?:ב?ביטקוין|bitcoin|usdt|ב-?usdt|btc|eth|איתריום|באיתריום)(?:$|[^\\u0590-\\u05FFa-z0-9])` +
    `|\\b(?:(?:in\\s+)?crypto|(?:in|to)\\s+wallet|crypto\\s*wallet|(?:paid|pay|paying|payer)\\s+(?:via|with|by|in)?\\s*(?:crypto|wallet|bitcoin|usdt|btc))\\b` +
  `)`,
  'i'
)

// Bit payment ("משלם בביט" / "שילם בביט" / "שולם בביט" / "משלם ביט" / "שילם ביט" / "בביט" / "ביט")
export const BIT_REGEX = new RegExp(
  `(?:` +
    `${HE_PAY_VERBS}\\s+ב?ביט(?![\\u0590-\\u05FFa-z0-9])` +
    `|(?:באפליקציית|באפליקציה|דרך|באמצעות)\\s+ב?ביט(?![\\u0590-\\u05FFa-z0-9])` +
    `|\\d+\\s*(?:₪|ש"ח|שח)?\\s*בביט(?![\\u0590-\\u05FFa-z0-9])` +
    `|(?:^|[^\\u0590-\\u05FFa-z0-9])בביט(?:$|[^\\u0590-\\u05FFa-z0-9])` +
    `|(?:^|[^\\u0590-\\u05FFa-z0-9])ביט(?![\\s]*[י]?ם)(?:$|[^\\u0590-\\u05FFa-z0-9])` +
    `|\\b(?:(?:paid|pay|paying|payer)\\s+(?:via|with|by|in)?\\s*bit|in\\s+bit|bit\\s+payment)\\b` +
  `)`,
  'i'
)

// Credit card / Bank transfer ("משלם באשראי" / "שילם באשראי" / "באשראי" / "העברה בנקאית")
export const CREDIT_REGEX = new RegExp(
  `(?:` +
    `${HE_PAY_VERBS}\\s+(?:ב?אשראי|כרטיס\\s*אשראי|בכרטיס\\s*אשראי|ב?העברה(?:\\s*בנקאית)?|בנקאי)` +
    `|(?:^|[^\\u0590-\\u05FFa-z0-9])(?:ב?אשראי|כרטיס\\s*אשראי|בכרטיס\\s*אשראי|ב?העברה\\s*בנקאית|בהעברה)(?:$|[^\\u0590-\\u05FFa-z0-9])` +
    `|\\b(?:(?:in\\s+)?credit(?:\\s*card)?|bank\\s*transfer|(?:paid|pay|paying|payer)\\s+(?:via|with|by|in)?\\s*(?:credit|credit\\s*card|bank\\s*transfer))\\b` +
  `)`,
  'i'
)

// General prepaid / zero collect ("שולם מראש" / "משלם מראש" / "0₪ לגביה" / "לגבות: 0")
export const PREPAID_REGEX = new RegExp(
  `(?:` +
    `${HE_PAY_VERBS}\\s+מראש` +
    `|(?:^|[^\\u0590-\\u05FFa-z0-9])מראש(?:$|[^\\u0590-\\u05FFa-z0-9])` +
    `|(?:לגבות\\s*:\\s*0|לגבות\\s+0|0\\s*לגבות|0\\s*₪?\\s*לגב(?:יי)?ה|אין\\s*לגבות|לא\\s*לגבות|ללא\\s*גב(?:יי)?ה|0\\s*במזומן|ללא\\s*מזומן)` +
    `|(?:^|\\s)0\\s*(?:₪|ש"ח|שח)\\b` +
    `|\\b(?:prepaid|paid\\s+in\\s+advance|zero\\s+cash|collect\\s+0)\\b` +
  `)`,
  'i'
)

/**
 * Checks whether a single line is a payment announcement (e.g. "משלם בביט", "שולם בקריפטו", "בארנק", "בקוד משיכה").
 * Used to avoid mistakenly classifying payment notes as menu items or warehouse deductions.
 */
export function isPaymentLine(line: string): boolean {
  if (!line || line.trim().length === 0) return false
  const hasBitsProduct = /(?:ביטים|בביטים|\bbits\b)/i.test(line)
  if (hasBitsProduct && !/(?:שולם|שילם|משלם|תשלום|הועבר|סליקה|לגבות|0₪)/i.test(line)) {
    return false
  }
  return (
    ATM_CODE_REGEX.test(line) ||
    CRYPTO_REGEX.test(line) ||
    BIT_REGEX.test(line) ||
    CREDIT_REGEX.test(line) ||
    PREPAID_REGEX.test(line)
  )
}

/**
 * Extracts payment method and prepaid status from text.
 * Detects: קריפטו, ארנק, ביט, קוד משיכה, אשראי, שולם מראש, 0₪, לגבות 0, etc.
 */
export function extractPaymentDetails(text: string, totalPrice: number): {
  paymentMethod: PaymentMethod
  isPrepaid: boolean
  cashToCollect: number
  paymentLabel: string
} {
  const lower = (text || '').toLowerCase()

  const hasAtmCode = ATM_CODE_REGEX.test(lower)
  const hasCrypto = CRYPTO_REGEX.test(lower)
  const hasBit = BIT_REGEX.test(lower)
  const hasCredit = CREDIT_REGEX.test(lower)
  const hasPrepaid =
    hasAtmCode ||
    hasCrypto ||
    hasBit ||
    hasCredit ||
    PREPAID_REGEX.test(lower)

  if (hasAtmCode) {
    return {
      paymentMethod: 'ATM_CODE',
      isPrepaid: true,
      cashToCollect: 0,
      paymentLabel: 'שולם בקוד משיכה (אצל מחסנאי)'
    }
  }

  if (hasCrypto) {
    return {
      paymentMethod: 'CRYPTO',
      isPrepaid: true,
      cashToCollect: 0,
      paymentLabel: 'שולם בקריפטו / ארנק'
    }
  }

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
  // Check if order was falsely flagged as BIT because of the warehouse product "ביטים"
  const rawAndNotes = [
    order.raw_message || '',
    order.notes || ''
  ].join(' ')

  const isFalseBitProduct =
    order.payment_method === 'BIT' &&
    /(?:ביטים|בביטים|\bbits\b)/i.test([order.raw_message, order.menu_items].join(' ')) &&
    !/(?:שולם\s+ב?ביט|שיל[םמ]\s+ב?ביט|משל[םמ]?(?:ת|ים)?\s+ב?ביט|תשלום\s+ב?ביט|הועבר\s+ב?ביט|העברה\s+ב?ביט|סליקה\s+ב?ביט|באפליקציית\s+ביט|שולם\s+מראש|לגבות\s*:\s*0|0\s*₪?\s*לגב(?:יי)?ה|(?:^|[^\u0590-\u05FFa-z0-9])בביט(?:$|[^\u0590-\u05FFa-z0-9]))/i.test(order.raw_message || '')

  const effectivePaymentMethod = isFalseBitProduct ? 'CASH' : (order.payment_method || 'CASH')
  const effectiveIsPrepaid = isFalseBitProduct ? false : (order.is_prepaid === true)

  const isPrepaidFlag =
    effectiveIsPrepaid ||
    effectivePaymentMethod === 'ATM_CODE' ||
    effectivePaymentMethod === 'CRYPTO' ||
    effectivePaymentMethod === 'BIT' ||
    effectivePaymentMethod === 'CREDIT' ||
    effectivePaymentMethod === 'PREPAID'

  const lower = rawAndNotes.toLowerCase()

  const hasAtmCode = effectivePaymentMethod === 'ATM_CODE' || ATM_CODE_REGEX.test(lower)
  const hasCrypto = effectivePaymentMethod === 'CRYPTO' || CRYPTO_REGEX.test(lower)
  const hasBit = effectivePaymentMethod === 'BIT' || BIT_REGEX.test(lower)
  const hasCredit = effectivePaymentMethod === 'CREDIT' || CREDIT_REGEX.test(lower)
  const hasPrepaid =
    isPrepaidFlag ||
    hasAtmCode ||
    hasCrypto ||
    hasBit ||
    hasCredit ||
    effectivePaymentMethod === 'PREPAID' ||
    PREPAID_REGEX.test(lower)

  const method: PaymentMethod = hasAtmCode
    ? 'ATM_CODE'
    : hasCrypto
    ? 'CRYPTO'
    : hasBit
    ? 'BIT'
    : hasCredit
    ? 'CREDIT'
    : hasPrepaid
    ? 'PREPAID'
    : 'CASH'

  const isPrepaid = hasPrepaid
  const totalPrice = Number(order.total_price || 0)
  const cashToCollect = isPrepaid ? 0 : totalPrice

  const labelHe = hasAtmCode
    ? 'שולם בקוד משיכה (אצל מחסנאי)'
    : hasCrypto
    ? 'שולם בקריפטו / ארנק'
    : hasBit
    ? 'שולם בביט'
    : hasCredit
    ? 'שולם באשראי'
    : isPrepaid
    ? 'שולם מראש'
    : 'מזומן'

  const badgeText = hasAtmCode
    ? '🏧 קוד משיכה'
    : hasCrypto
    ? '🪙 קריפטו'
    : hasBit
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
  const rawLines = cleanRaw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^(?:אתמול ב-|היום ב-|\d{1,2}[:.]\d{2}(?:\s|$)|forwarded from|הודעה שהועברה|נשלח מ-|.*(?:הסדרן|סדרן\b|המוקד|מוקד הזמנות).*)/i.test(l))

  let customerName = ''
  let city = ''
  let phoneNumber = ''
  let telegramHandle: string | undefined
  let customerType = 'קבוע'
  let totalPrice = 0.0
  let brand = 'כללי'
  const menuLines: string[] = []
  const deductions: ParsedItemDeduction[] = []

  // 0. Extract Price anywhere in the message (across all lines or full message text)
  // Ensures that wherever the user writes 500₪ or 1,100₪ in the message (top, middle, bottom),
  // it is immediately and accurately extracted!
  for (const line of rawLines) {
    const p = extractPrice(line)
    if (p > 0) {
      totalPrice = p
      break
    }
  }
  if (totalPrice === 0) {
    totalPrice = extractPrice(cleanRaw)
  }

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
      const line = rawLines[i]
      const hasPrice = extractPrice(line) > 0 || /(?:₪|ש"?ח|nis|ils)/i.test(line)
      // Payment indicators and price lines are never warehouse deductions
      if (!isPaymentLine(line) && !hasPrice) {
        trailingDeductionLines.push(line)
      }
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

    // 4. Check for Price (fallback if not already extracted)
    if (totalPrice === 0) {
      const foundPrice = extractPrice(line)
      if (foundPrice > 0) {
        totalPrice = foundPrice
      }
    }

    // 5. Line 1: In the vast majority of cases, Line 1 is the Customer Name / Address
    if (i === 0 && !customerName) {
      customerName = line
      const extracted = extractCityFromAddress(line)
      city = extracted.city
    }

    // 6. Check for Separator / "Slash" inventory rule: "Menu Item / Warehouse Deduction"
    // Examples: "2 גלאטו 33/ 20 רפואי האני", "1 רפואי מיאמי סקי 🔥 רפואי האני", "100 ביטים גנטיקה ❤️ רפואי פיינאפל"
    let separator: string | null = null
    if (line.includes('/')) separator = '/'
    else if (line.includes('|')) separator = '|'
    else if (line.includes('—')) separator = '—'
    else if (line.includes('\\')) separator = '\\'
    else {
      // Check if an emoji is used as a separator between menu item and warehouse strain
      // Exclude regional indicator flags (e.g. 🇮🇱, 🇺🇸) which indicate strain origin!
      const emojiMatch = line.match(/\s*([\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\p{Extended_Pictographic}])\s*/u)
      if (emojiMatch && emojiMatch[1] && !/[\u{1F1E6}-\u{1F1FF}]/u.test(emojiMatch[1])) {
        const candidateSep = emojiMatch[1]
        const testParts = line.split(candidateSep)
        if (testParts.length >= 2 && testParts[0].trim().length > 0 && testParts[1].trim().length > 0) {
          separator = candidateSep
        }
      }
    }

    if (separator) {
      const slashParts = line.split(separator)
      const menuPart = slashParts[0].trim()
      const warehousePart = slashParts.slice(1).join(' ').trim()

      menuLines.push(menuPart)

      let matchedProd = matchWarehouseProduct(warehousePart)
      if (matchedProd) {
        // If warehouse part did not specify explicit quantity, but menu part had quantity like "1", "100"
        if (matchedProd.quantity === 1.0 && !/\d/.test(warehousePart)) {
          const menuQtyMatch = menuPart.match(/(?:^|\s)(\d+(?:\.\d+)?)/)
          if (menuQtyMatch) {
            const packCount = parseFloat(menuQtyMatch[1])
            if (packCount === 1.0 && matchedProd.product.category === 'רפואי פרימיום' && matchedProd.unit === 'g') {
              // 1 pack of medical cannabis in Israel is 10g
              matchedProd.quantity = 10
            } else {
              matchedProd.quantity = packCount
            }
          }
        }

        deductions.push({
          menuName: menuPart,
          warehouseProductName: matchedProd.product.name,
          quantity: matchedProd.quantity,
          unit: matchedProd.unit,
          matchedProductCategory: matchedProd.product.category
        })
      } else {
        // Fallback deduction if name doesn't match catalog: cleanly parse quantity & unit
        const qtyRegex = /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:גרם|ג['׳]|g|יח['׳]|יחידות)?/i
        const qMatch = warehousePart.match(qtyRegex)
        let extractedQty = qMatch ? parseFloat(qMatch[1]) : 1.0
        let extractedUnit = 'g'
        if (qMatch && /(?:יח|יחידות)/i.test(qMatch[0])) {
          extractedUnit = 'units'
        }
        let cleanedWarehouseName = warehousePart
          .replace(qtyRegex, ' ')
          .replace(/(?:מתנה|כולל משלוח|בוטיק|פרימיום|לפנק)/g, ' ')
          .trim()
        if (!cleanedWarehouseName) cleanedWarehouseName = warehousePart.trim()

        deductions.push({
          menuName: menuPart,
          warehouseProductName: cleanedWarehouseName,
          quantity: extractedQty,
          unit: extractedUnit
        })
      }
    } else {
      // Check if this line is an item line (not address, phone, price, handle, tier, brand, or payment line)
      const isPayLine = isPaymentLine(line)
      const isBrandLine = Boolean(matchBrand(line))
      const isVerificationLine = /(?:אימות|אושר|אישור\s*הזמנה|מאושר|בדיקה|מנהל\s+גיבוי\s+הזמנות|סדרן|הסדרן|מוקד|המוקד|משלוח\s*חיצוני|חיצוני)/i.test(line)
      const isPureSymbolOrEmoji = normalizeHebrewText(line).length === 0 && !/\d/.test(line)

      const isPriceLine = extractPrice(line) > 0 || /(?:₪|ש"?ח|nis|ils)/i.test(line)
      const strippedPrice = isPriceLine ? stripPriceFromText(line) : line
      const isPurePriceLine = isPriceLine && (strippedPrice.length === 0 || !/[\u0590-\u05FFa-zA-Z0-9]/.test(strippedPrice))

      const isNotMeta = !line.match(phoneRegex) &&
        !line.match(/@([A-Za-z0-9_]+)/) &&
        !isPurePriceLine &&
        !line.match(/לקוח קבוע|לקוח חדש/) &&
        !isPayLine &&
        !isBrandLine &&
        !isVerificationLine &&
        !isPureSymbolOrEmoji &&
        line !== customerName

      if (isNotMeta) {
        const itemText = isPriceLine ? strippedPrice : line
        if (itemText.trim().length > 0) {
          menuLines.push(itemText.trim())
        }
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
      // If customer is returning an item (e.g. "מחזיר", "החזרה"), do not deplete warehouse stock
      const isReturn = /(?:מחזיר|החזיר|החזרה|להחזיר)/i.test(line)
      if (isReturn) {
        continue
      }
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

  // If customer paid via ATM withdrawal code and specified explicit amount (e.g. "משלם בקוד משיכה 1300 ‼️")
  if (paymentDetails.paymentMethod === 'ATM_CODE') {
    const atmMatch = cleanRaw.match(/(?:(?:משל[םמ](?:ת|ים)?|שול[םמ]|שיל[םמ]|תשלום)\s+(?:ב?קוד(?:\s*משיכה)?|ב?משיכה|ב?כספומט)|ב?קוד\s*משיכה|ב?משיכה|ב?קוד\s*כספומט|בקוד)\s*(?::\s*)?(\d[\d,]*)/i)
    if (atmMatch) {
      const explicitAtmPrice = parseFloat(atmMatch[1].replace(/,/g, ''))
      if (!isNaN(explicitAtmPrice) && explicitAtmPrice > 0) {
        totalPrice = explicitAtmPrice
      }
    }
  }

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
