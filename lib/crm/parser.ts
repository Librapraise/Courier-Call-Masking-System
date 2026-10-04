import { extractCityFromAddress } from './israeli-cities'
import { matchBrand, matchWarehouseProduct, MatchedWarehouseProduct } from './fuzzy-matcher'

export interface ParsedItemDeduction {
  menuName: string
  warehouseProductName: string
  quantity: number
  unit: string
  matchedProductCategory?: string
}

export interface ParsedDeliveryOrder {
  customerName: string       // Delivery address used as customer identity (e.g. "מרקו לויז - הנשיאים 57 פתח תקווה")
  city: string               // Extracted city (e.g. "פתח תקווה")
  phoneNumber: string        // Normalized Israeli phone (05XXXXXXXX)
  telegramHandle?: string    // @username
  customerType: string       // "קבוע", "חדש", "VIP"
  totalPrice: number         // Cash price
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

  return {
    customerName,
    city: city || 'אחר',
    phoneNumber,
    telegramHandle,
    customerType,
    totalPrice,
    brand,
    menuItems: menuItemsSummary,
    actualItems: actualItemsSummary,
    deductions,
    rawText
  }
}

export const parseSingleOrderMessage = parseDeliveryMessage
