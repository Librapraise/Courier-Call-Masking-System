/**
 * GhostCRM End-of-Day Batch Inventory Depletion Parser & Financial Valuation
 */

import { matchWarehouseProduct } from './fuzzy-matcher'

export interface DepletionLineItem {
  rawLine: string
  productName: string
  matchedProductId?: string
  matchedProductName: string
  category: string
  quantity: number
  unit: string
  currentStock: number
  newStock: number
  costPerUnit: number
  totalCost: number
  todayRevenue: number
  grossProfit: number
  isMatched: boolean
}

export interface BatchDepletionReport {
  totalItemsCount: number
  totalQuantityDepleted: number
  totalCostOfGoods: number
  totalRevenueToday: number
  totalGrossProfit: number
  items: DepletionLineItem[]
  unmatchedItems: { rawLine: string; extractedName: string; quantity: number }[]
  timestamp: string
}

export interface CatalogProductSummary {
  id: string
  name: string
  category?: string
  unit?: string
  stock_on_hand?: number
  cost_per_unit?: number
  aliases?: string[]
}

/**
 * Normalizes Hebrew text for product matching
 */
function normalizeHebrew(text: string): string {
  return text
    .toLowerCase()
    .replace(/[״״"']/g, '')
    .replace(/[\u0591-\u05C7]/g, '') // remove nikud
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Common product alias map for short slang used in end-of-day Telegram notes
 */
const SLANG_PRODUCT_MAP: Record<string, string> = {
  'זלושי יבוא': 'זלושי יבוא',
  'זלושי': 'זלושי יבוא',
  'פופ כתום': 'פופקורן כתום',
  'פופ סגול': 'פופקורן סגול',
  'פופ בוטיק': 'תפזורת בוטיק',
  'רפואי האני': 'רפואי האני',
  'רפואי דראג': 'רפואי דראג',
  'רפואי דרג': 'רפואי דראג',
  'רפואי תפוז': 'רפואי תפוז',
  'רפואי פינאפל': 'רפואי פינאפל',
  'רפואי פיינאפל': 'רפואי פינאפל',
  'ביטים בננה': 'ביטים בננה',
  'גבוה': 'גבוהה VIP',
  'גבוהה': 'גבוהה VIP',
  'ריינבו גדול': 'ריינבו גדול',
  'ריינבו': 'ריינבו גדול',
  'רפואי גלקסי': 'רפואי גלאקסי',
  'רפואי גלאקסי': 'רפואי גלאקסי',
  'רפואי מלון': 'רפואי מלון',
  'רפואי דקסטר': 'רפואי דקסטר',
  'סודה טריפ': 'סודה טרייפ באצונים'
}

/**
 * Parses end-of-day depletion messages (e.g. from Telegram forward or CRM input)
 */
export function parseBatchDepletionMessage(
  rawText: string,
  catalogProducts: CatalogProductSummary[],
  todaySalesMap?: Map<string, number> // productName -> total revenue today
): BatchDepletionReport {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const items: DepletionLineItem[] = []
  const unmatchedItems: { rawLine: string; extractedName: string; quantity: number }[] = []

  // Create fast lookup maps from catalog products
  const productMapByName = new Map<string, CatalogProductSummary>()
  const productMapByNormalized = new Map<string, CatalogProductSummary>()

  for (const p of catalogProducts) {
    productMapByName.set(p.name, p)
    productMapByNormalized.set(normalizeHebrew(p.name), p)
    if (p.aliases) {
      for (const a of p.aliases) {
        productMapByNormalized.set(normalizeHebrew(a), p)
      }
    }
  }

  for (const line of lines) {
    // Skip general header lines
    if (/^(?:להוריד\s+מהמלאי|פריקת\s+מלאי|סגירת\s+מלאי|דוח\s+מלאי|מלאי\s+יומי|שלום|בברכה)/i.test(line)) {
      continue
    }

    // Try parsing: [Product Name] - [Quantity] or [Product Name] [Quantity]
    let namePart = ''
    let qty = 0

    // Match "Name - 10" or "Name- 10" or "Name: 10"
    const dashMatch = line.match(/^(.+?)\s*[-–—:]\s*(\d+(?:\.\d+)?)\s*(?:גרם|יח['״]|ג|g)?$/)
    if (dashMatch) {
      namePart = dashMatch[1].trim()
      qty = parseFloat(dashMatch[2])
    } else {
      // Match "10 Name" or "10g Name"
      const prefixMatch = line.match(/^(\d+(?:\.\d+)?)\s*(?:גרם|יח['״]|ג|g)?\s+(.+)$/)
      if (prefixMatch) {
        qty = parseFloat(prefixMatch[1])
        namePart = prefixMatch[2].trim()
      } else {
        // Match "Name 10"
        const suffixMatch = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:גרם|יח['״]|ג|g)?$/)
        if (suffixMatch) {
          namePart = suffixMatch[1].trim()
          qty = parseFloat(suffixMatch[2])
        }
      }
    }

    if (!namePart || isNaN(qty) || qty <= 0) {
      continue
    }

    // Clean namePart from emojis or bullet points
    const cleanName = namePart
      .replace(/^[•\-\*\>]\s*/, '')
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\p{Extended_Pictographic}]/gu, '')
      .trim()

    const normName = normalizeHebrew(cleanName)

    // 1. Direct lookup or slang map
    let targetStandardName = SLANG_PRODUCT_MAP[cleanName] || SLANG_PRODUCT_MAP[normName] || cleanName

    let matchedProd =
      productMapByName.get(targetStandardName) ||
      productMapByNormalized.get(normalizeHebrew(targetStandardName)) ||
      productMapByName.get(cleanName) ||
      productMapByNormalized.get(normName)

    // 2. Fuzzy matcher fallback if not resolved
    if (!matchedProd) {
      const fuzzyTarget = matchWarehouseProduct(cleanName)
      if (fuzzyTarget) {
        matchedProd = productMapByName.get(fuzzyTarget.product.name) || productMapByNormalized.get(normalizeHebrew(fuzzyTarget.product.name))
      }
    }

    // 3. Substring matching fallback
    if (!matchedProd) {
      for (const [pName, prod] of productMapByName.entries()) {
        const normP = normalizeHebrew(pName)
        if (normP.includes(normName) || normName.includes(normP)) {
          matchedProd = prod
          break
        }
      }
    }

    if (matchedProd) {
      const currentStock = Number(matchedProd.stock_on_hand) || 0
      const newStock = Math.max(0, currentStock - qty)
      const costPerUnit = Number(matchedProd.cost_per_unit) || 0
      const totalCost = qty * costPerUnit
      const todayRevenue = todaySalesMap ? (todaySalesMap.get(matchedProd.name) || 0) : 0
      const grossProfit = todayRevenue - totalCost

      items.push({
        rawLine: line,
        productName: cleanName,
        matchedProductId: matchedProd.id,
        matchedProductName: matchedProd.name,
        category: matchedProd.category || 'כללי',
        quantity: qty,
        unit: matchedProd.unit || 'g',
        currentStock,
        newStock,
        costPerUnit,
        totalCost,
        todayRevenue,
        grossProfit,
        isMatched: true
      })
    } else {
      unmatchedItems.push({
        rawLine: line,
        extractedName: cleanName,
        quantity: qty
      })
    }
  }

  const totalQuantityDepleted = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalCostOfGoods = items.reduce((sum, i) => sum + i.totalCost, 0)
  const totalRevenueToday = items.reduce((sum, i) => sum + i.todayRevenue, 0)
  const totalGrossProfit = totalRevenueToday - totalCostOfGoods

  return {
    totalItemsCount: items.length,
    totalQuantityDepleted,
    totalCostOfGoods,
    totalRevenueToday,
    totalGrossProfit,
    items,
    unmatchedItems,
    timestamp: new Date().toISOString()
  }
}

/**
 * Formats Telegram and copy-ready markdown report for End-of-Day Depletion
 */
export function formatDepletionTelegramReport(report: BatchDepletionReport): string {
  const dateStr = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })
  const timeStr = new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })

  let msg = `📋 *דוח פריקת מלאי יומית ועלויות | סגירת משמרת*\n`
  msg += `📅 *תאריך:* ${dateStr} | 🕒 *שעה:* ${timeStr}\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  report.items.forEach((item, idx) => {
    const unitLabel = item.unit === 'g' ? 'גרם' : 'יח׳'
    msg += `*${idx + 1}. ${item.matchedProductName}*\n`
    msg += `  ▫️ כמות שנפרקה: *${item.quantity} ${unitLabel}*\n`
    if (item.costPerUnit > 0) {
      msg += `  ▫️ עלות ליחידה: ₪${item.costPerUnit.toLocaleString()}\n`
      msg += `  ▫️ עלות כוללת: *₪${item.totalCost.toLocaleString()}*\n`
    }
    if (item.todayRevenue > 0) {
      msg += `  ▫️ הכנסות ממכירה: ₪${item.todayRevenue.toLocaleString()}\n`
      msg += `  ▫️ רווח גולמי: *₪${item.grossProfit.toLocaleString()}*\n`
    }
    msg += `  ▫️ יתרת מלאי עדכנית: *${item.newStock} ${unitLabel}*\n\n`
  })

  if (report.unmatchedItems.length > 0) {
    msg += `⚠️ *פריטים שלא נמצאו בקטלוג:*\n`
    report.unmatchedItems.forEach(u => {
      msg += `  ▫️ ${u.extractedName} (${u.quantity})\n`
    })
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`
  }

  msg += `📊 *סיכום פיננסי ועלויות סחורה:*\n`
  msg += `📦 סה״כ מוצרים שנפרקו: *${report.totalQuantityDepleted.toLocaleString()} גרם/יחידות*\n`
  if (report.totalCostOfGoods > 0) {
    msg += `📉 סה״כ עלות סחורה שנמכרה (COGS): *₪${report.totalCostOfGoods.toLocaleString()}*\n`
  }
  if (report.totalRevenueToday > 0) {
    msg += `💰 סה״כ מחזור מכירות משוער: *₪${report.totalRevenueToday.toLocaleString()}*\n`
    msg += `💎 *רווח גולמי כולל מהמלאי: ₪${report.totalGrossProfit.toLocaleString()}*\n`
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `✅ המלאי במערכת עודכן בהצלחה.`

  return msg
}
