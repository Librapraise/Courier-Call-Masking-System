import { extractCityFromAddress } from './israeli-cities'
import { matchBrand, matchWarehouseProduct, MatchedWarehouseProduct } from './fuzzy-matcher'

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
 * Detects: קריפטו, ביט, אשראי, שולם מראש, שולם בביט, 0₪, לגבות 0, etc.
 */
export function extractPaymentDetails(text: string, totalPrice: number): {
  paymentMethod: PaymentMethod
  isPrepaid: boolean
  cashToCollect: number
  paymentLabel: string
} {
  const lower = (text || '').toLowerCase()

  // Match ATM Cash Withdrawal Code ("קוד משיכה" / "משלם בקוד משיכה" / "קוד כספומט" / "במשיכה")
  const hasAtmCode =
    /(?:קוד\s*משיכה|בקוד\s*משיכה|משל[םמ]?(?:ת|ים)?\s*(?:ב?קוד(?:\s*משיכה)?|במשיכה)|שולם\s*ב?קוד|הועבר\s*ב?קוד|משיכה\s*ללא\s*כרטיס|קוד\s*כספומט|במשיכה)/i.test(lower)

  // Match Crypto phrases
  const hasCrypto =
    /(?:שולם\s+ב?קריפטו|הועבר\s+ב?קריפטו|סליקה\s+ב?קריפטו|משלמ?ת?\s+ב?קריפטו|(?:\d+\s*(?:₪|ש"ח|שח)?\s*ב?קריפטו)|(?:^|\s)בקריפטו(?:$|\s|[.,!‼️?]+)|(?:^|\s)קריפטו(?:$|\s|[.,!‼️?]+)|paid\s+(?:via|with|by|in)\s+crypto|(?:^|\s)crypto(?:$|\s|[.,!‼️?]+)|(?:שולם\s+ב?|הועבר\s+ב?)?(?:ביטקוין|בביטקוין|bitcoin|usdt|btc))/i.test(lower)

  // Match ONLY explicit Bit payment phrases like "שולם בביט", "הועבר בביט", "משלם בביט"
  // NEVER standalone "ביט" or "ביטים" or "בביט" (which is a warehouse strain/product category!)
  const hasBit =
    /(?:שולם\s+ב?ביט|הועבר\s+ב?ביט|סליקה\s+ב?ביט|באפליקציית\s+ביט|משלמ?ת?\s+ב?ביט|(?:\d+\s*(?:₪|ש"ח|שח)?\s*בביט)|paid\s+(?:via|with|by|in)\s+bit)/i.test(lower)

  // Match explicit credit phrases
  const hasCredit =
    /(?:שולם\s+ב?אשראי|סליקה\s+ב?אשראי|באשראי|כרטיס\s+אשראי|paid\s+(?:via|with|by|in)\s+credit)/i.test(lower)

  // Match explicit prepaid / zero collect phrases
  const hasPrepaid =
    hasAtmCode ||
    hasCrypto ||
    hasBit ||
    hasCredit ||
    /(?:שולם\s+מראש|שולם\s+קודם|prepaid|paid\s+in\s+advance|לגבות\s*:\s*0|לגבות\s+0|0\s*₪?\s*לגב(?:יי)?ה)/i.test(lower) ||
    /(?:^|\s)0\s*(?:₪|ש"ח|שח)\b/.test(lower) ||
    totalPrice === 0

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
      paymentLabel: 'שולם בקריפטו'
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
    !/(?:שולם\s+ב?ביט|הועבר\s+ב?ביט|סליקה\s+ב?ביט|באפליקציית\s+ביט|משלמ?ת?\s+(?:\d+\s+)?ב?ביט|שולם\s+מראש|לגבות\s*:\s*0|0\s*₪?\s*לגב(?:יי)?ה)/i.test(order.raw_message || '')

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

  // Match ATM Cash Withdrawal Code ("קוד משיכה" / "משלם בקוד משיכה" / "קוד כספומט" / "במשיכה")
  const hasAtmCode =
    effectivePaymentMethod === 'ATM_CODE' ||
    /(?:קוד\s*משיכה|בקוד\s*משיכה|משל[םמ]?(?:ת|ים)?\s*(?:ב?קוד(?:\s*משיכה)?|במשיכה)|שולם\s*ב?קוד|הועבר\s*ב?קוד|משיכה\s*ללא\s*כרטיס|קוד\s*כספומט|במשיכה)/i.test(lower)

  const hasCrypto =
    effectivePaymentMethod === 'CRYPTO' ||
    /(?:שולם\s+ב?קריפטו|הועבר\s+ב?קריפטו|סליקה\s+ב?קריפטו|משלמ?ת?\s+ב?קריפטו|(?:\d+\s*(?:₪|ש"ח|שח)?\s*ב?קריפטו)|(?:^|\s)בקריפטו(?:$|\s|[.,!‼️?]+)|(?:^|\s)קריפטו(?:$|\s|[.,!‼️?]+)|paid\s+(?:via|with|by|in)\s+crypto|(?:^|\s)crypto(?:$|\s|[.,!‼️?]+)|(?:שולם\s+ב?|הועבר\s+ב?)?(?:ביטקוין|בביטקוין|bitcoin|usdt|btc))/i.test(lower)

  const hasBit =
    effectivePaymentMethod === 'BIT' ||
    /(?:שולם\s+ב?ביט|הועבר\s+ב?ביט|סליקה\s+ב?ביט|באפליקציית\s+ביט|משלמ?ת?\s+ב?ביט|(?:\d+\s*(?:₪|ש"ח|שח)?\s*בביט)|paid\s+(?:via|with|by|in)\s+bit)/i.test(lower)

  const hasCredit =
    effectivePaymentMethod === 'CREDIT' ||
    /(?:שולם\s+ב?אשראי|סליקה\s+ב?אשראי|באשראי|כרטיס\s+אשראי|paid\s+(?:via|with|by|in)\s+credit)/i.test(lower)

  const hasPrepaid =
    isPrepaidFlag ||
    hasAtmCode ||
    hasCrypto ||
    hasBit ||
    hasCredit ||
    effectivePaymentMethod === 'PREPAID' ||
    /(?:שולם\s+מראש|שולם\s+קודם|prepaid|paid\s+in\s+advance|לגבות\s*:\s*0|לגבות\s+0|0\s*₪?\s*לגב(?:יי)?ה)/i.test(lower) ||
    /(?:^|\s)0\s*(?:₪|ש"ח|שח)\b/.test(lower) ||
    Number(order.total_price || 0) === 0

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
    ? 'שולם בקריפטו'
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
    .filter(l => l.length > 0 && !/^(?:אתמול ב-|היום ב-|\d{1,2}[:.]\d{2}\s|forwarded from)/i.test(l))

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
      const line = rawLines[i]
      // Payment indicators (e.g. "שולם בקריפטו", "שולם בביט", "משלם בקוד משיכה") are never warehouse deductions
      const isPaymentLine = /(?:שולם|הועבר|סליקה|משל[םמ]?(?:ת|ים)?|קריפטו|crypto|ביט|bit|אשראי|credit|prepaid|קוד\s*משיכה|בקוד|במשיכה|כספומט)/i.test(line) &&
        !/(?:ביטים|בביטים)/i.test(line)
      if (!isPaymentLine) {
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
        // Fallback deduction if name doesn't match catalog
        deductions.push({
          menuName: menuPart,
          warehouseProductName: warehousePart,
          quantity: 1,
          unit: 'g'
        })
      }
    } else {
      // Check if this line is an item line (not address, phone, price, handle, tier, brand, or payment line)
      const isPaymentLine = /(?:שולם|הועבר|סליקה|משלמ?ת?|קריפטו|crypto|ביט|bit|אשראי|credit|prepaid|קוד\s+משיכה|כספומט|במשיכה)/i.test(line) &&
        !/(?:ביטים|בביטים)/i.test(line)

      const isBrandLine = Boolean(matchBrand(line))
      const isVerificationLine = /(?:אימות|אושר|אישור\s*הזמנה|מאושר|בדיקה|מנהל\s+גיבוי\s+הזמנות)/i.test(line)

      const isNotMeta = !line.match(phoneRegex) &&
        !line.match(/@([A-Za-z0-9_]+)/) &&
        !line.match(/(?:₪|ש"ח|כולל משלוח)/) &&
        !line.match(/לקוח קבוע|לקוח חדש/) &&
        !isPaymentLine &&
        !isBrandLine &&
        !isVerificationLine &&
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

  // If customer paid via ATM withdrawal code and specified explicit amount (e.g. "משלם בקוד משיכה 1300 ‼️")
  if (paymentDetails.paymentMethod === 'ATM_CODE') {
    const atmMatch = cleanRaw.match(/(?:משלמ?ת?\s+ב?קוד\s+משיכה|קוד\s+משיכה|במשיכה|קוד\s+כספומט)\s*(\d[\d,]*)/i)
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
