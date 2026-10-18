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
    .replace(/\p{Extended_Pictographic}|\p{Emoji}/gu, '') // Strip ALL Unicode emojis & symbols
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[–—\-.,\/#!$%\^&\*;:{}=\-_`~()!?‼\uFE0F]/gu, ' ')
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
  if (!cleaned || cleaned.length < 2) return null

  // Strip leading Hebrew definite article 'ה' (e.g. "מחתרת בני אור" vs "המחתרת בני אור")
  const stripHePrefix = (s: string) => s.replace(/^ה(?=[\u0590-\u05FF]{3,})/i, '').trim()
  const cleanedNoHe = stripHePrefix(cleaned)

  // 1. Exact or substring match
  for (const brand of BRANDS_LIST) {
    const cleanBrand = normalizeHebrewText(brand)
    const cleanBrandNoHe = stripHePrefix(cleanBrand)

    if (
      cleaned === cleanBrand ||
      cleanedNoHe === cleanBrandNoHe ||
      (cleaned.length >= 4 && cleanBrand.includes(cleaned)) ||
      (cleanBrand.length >= 4 && cleaned.includes(cleanBrand)) ||
      (cleanedNoHe.length >= 4 && cleanBrandNoHe.includes(cleanedNoHe)) ||
      (cleanBrandNoHe.length >= 4 && cleanedNoHe.includes(cleanBrandNoHe))
    ) {
      return brand
    }
  }

  // 2. Token sequence and phrase matching (handles trailing notes like "מלך התפזורת לשים בסיכום אליהו")
  const inputTokens = cleaned.split(' ').filter(Boolean)
  const inputTokensNoHe = cleanedNoHe.split(' ').filter(Boolean)

  for (const brand of BRANDS_LIST) {
    const brandTokens = normalizeHebrewText(brand).split(' ').filter(Boolean)
    const brandTokensNoHe = brandTokens.map(stripHePrefix)

    if (brandTokens.length >= 2) {
      // Check if input contains the consecutive brand tokens
      for (let start = 0; start <= inputTokens.length - brandTokens.length; start++) {
        let allMatched = true
        for (let b = 0; b < brandTokens.length; b++) {
          const inTok = inputTokens[start + b]
          const inTokNoHe = inputTokensNoHe[start + b] || inTok
          const bTok = brandTokens[b]
          const bTokNoHe = brandTokensNoHe[b]

          const matchWord =
            inTok === bTok ||
            inTokNoHe === bTokNoHe ||
            levenshteinDistance(inTok, bTok) <= 1 ||
            levenshteinDistance(inTokNoHe, bTokNoHe) <= 1

          if (!matchWord) {
            allMatched = false
            break
          }
        }
        if (allMatched) {
          return brand
        }
      }
    } else if (brandTokens.length === 1 && brandTokens[0].length >= 4) {
      // Single word brand e.g. "קוקיס", "המשגיחים"
      const bTok = brandTokens[0]
      const bTokNoHe = brandTokensNoHe[0]
      for (let i = 0; i < inputTokens.length; i++) {
        const inTok = inputTokens[i]
        const inTokNoHe = inputTokensNoHe[i] || inTok
        if (
          inTok === bTok ||
          inTokNoHe === bTokNoHe ||
          (inTok.length >= 4 && levenshteinDistance(inTok, bTok) <= 1) ||
          (inTokNoHe.length >= 4 && levenshteinDistance(inTokNoHe, bTokNoHe) <= 1)
        ) {
          return brand
        }
      }
    }
  }

  // 3. Fuzzy match with Levenshtein distance <= 3
  let bestMatch: string | null = null
  let minDistance = 4

  for (const brand of BRANDS_LIST) {
    const cleanBrand = normalizeHebrewText(brand)
    const cleanBrandNoHe = stripHePrefix(cleanBrand)
    const dist = Math.min(
      levenshteinDistance(cleaned, cleanBrand),
      levenshteinDistance(cleanedNoHe, cleanBrandNoHe)
    )
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
