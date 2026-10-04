import { CATALOG_PRODUCTS, BRANDS_LIST, ProductCatalogItem } from './catalog-data'

/**
 * Calculates Levenshtein Distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length
  const n = s2.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return dp[m][n]
}

/**
 * Normalizes Hebrew text for comparison:
 * - Strips emojis and punctuation (except quotes/apostrophes in Hebrew abbreviations)
 * - Normalizes common interchangeable Hebrew vowel letters ('א', 'ו', 'י')
 */
export function normalizeHebrewText(text: string): string {
  if (!text) return ''
  return text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // Emojis
    .replace(/[–—\-.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/["']/g, '') // remove quotes like in צ'יפס -> ציפס
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Matches a brand string against the 37 pre-seeded brands.
 * Handles emojis, decorative symbols, and slight typos.
 */
export function matchBrand(rawText: string): string | null {
  if (!rawText) return null
  const cleaned = normalizeHebrewText(rawText)

  // 1. Exact or substring match
  for (const brand of BRANDS_LIST) {
    const cleanBrand = normalizeHebrewText(brand)
    if (cleaned === cleanBrand || cleaned.includes(cleanBrand) || cleanBrand.includes(cleaned)) {
      return brand
    }
  }

  // 2. Fuzzy match with Levenshtein distance <= 2
  let bestMatch: string | null = null
  let minDistance = 3

  for (const brand of BRANDS_LIST) {
    const cleanBrand = normalizeHebrewText(brand)
    const dist = levenshteinDistance(cleaned, cleanBrand)
    if (dist < minDistance) {
      minDistance = dist
      bestMatch = brand
    }
  }

  return bestMatch
}

export interface MatchedWarehouseProduct {
  product: ProductCatalogItem
  quantity: number
  unit: string
  confidence: number
}

/**
 * Fuzzy matches a warehouse product string and extracts quantity.
 * Examples:
 * - '20 רפואי האני' -> Product 'רפואי האני', quantity 20, unit 'g'
 * - '20 רפואי גלקסי' -> Product 'רפואי גלאקסי' (typo match), quantity 20, unit 'g'
 * - '10 טריפ ציפ גדול' -> Product 'צ'יפ טריפ גדול', quantity 10, unit 'g'
 * - 'חשיש בלונדי מתנה' -> Product 'חשיש בלונדי', quantity 1, unit 'g'
 */
export function matchWarehouseProduct(rawItemStr: string): MatchedWarehouseProduct | null {
  if (!rawItemStr) return null

  // Extract quantity from the string (e.g. '20 גרם', '20g', '20', '3')
  const qtyRegex = /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:גרם|ג['׳]|g|יח['׳]|יחידות)?/i
  const qtyMatch = rawItemStr.match(qtyRegex)
  const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 1.0

  // Clean the text to isolate the product name
  let nameOnly = rawItemStr
    .replace(/(?:^|\s)\d+(?:\.\d+)?\s*(?:גרם|ג['׳]|g|יח['׳]|יחידות)?/gi, ' ')
    .replace(/(?:מתנה|כולל משלוח|בוטיק|פרימיום|לפנק)/g, ' ')
    .trim()

  const normalizedInput = normalizeHebrewText(nameOnly)
  if (!normalizedInput || normalizedInput.length < 2) return null

  // 1. Direct match on official name or aliases
  for (const product of CATALOG_PRODUCTS) {
    const normOfficial = normalizeHebrewText(product.name)
    if (normalizedInput === normOfficial || normalizedInput.includes(normOfficial)) {
      return { product, quantity, unit: product.unit, confidence: 1.0 }
    }

    for (const alias of product.aliases) {
      const normAlias = normalizeHebrewText(alias)
      if (normalizedInput === normAlias || normalizedInput.includes(normAlias)) {
        return { product, quantity, unit: product.unit, confidence: 0.95 }
      }
    }
  }

  // 2. Token overlap & Fuzzy match (handles missing vowels like גלקסי vs גלאקסי)
  let bestMatch: ProductCatalogItem | null = null
  let highestScore = 0

  for (const product of CATALOG_PRODUCTS) {
    const candidates = [product.name, ...product.aliases]
    for (const cand of candidates) {
      const normCand = normalizeHebrewText(cand)

      // Token inclusion check
      const inputTokens = normalizedInput.split(' ').filter(t => t.length > 1)
      const candTokens = normCand.split(' ').filter(t => t.length > 1)

      const commonTokens = inputTokens.filter(t => candTokens.some(ct => ct === t || levenshteinDistance(ct, t) <= 1))
      if (commonTokens.length > 0) {
        const score = commonTokens.length / Math.max(inputTokens.length, candTokens.length)
        if (score > highestScore && score >= 0.5) {
          highestScore = score
          bestMatch = product
        }
      }

      // Levenshtein close distance
      const dist = levenshteinDistance(normalizedInput, normCand)
      if (dist <= 2) {
        const score = 1 - (dist / Math.max(normalizedInput.length, normCand.length))
        if (score > highestScore) {
          highestScore = score
          bestMatch = product
        }
      }
    }
  }

  if (bestMatch && highestScore >= 0.5) {
    return {
      product: bestMatch,
      quantity,
      unit: bestMatch.unit,
      confidence: highestScore
    }
  }

  return null
}
