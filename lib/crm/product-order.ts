import fs from 'node:fs'
import path from 'node:path'

const ORDER_FILE = path.join(process.cwd(), 'data', 'product_order.json')

/**
 * Returns the saved custom order array of product IDs or names.
 */
export function getLocalProductOrder(): string[] {
  try {
    if (fs.existsSync(ORDER_FILE)) {
      const content = fs.readFileSync(ORDER_FILE, 'utf-8')
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('[ProductOrder] Error reading custom order file:', e)
  }
  return []
}

/**
 * Persists custom order array of product IDs or names to disk.
 */
export function saveLocalProductOrder(orderIds: string[]): void {
  try {
    const dir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(ORDER_FILE, JSON.stringify(orderIds, null, 2), 'utf-8')
  } catch (e) {
    console.error('[ProductOrder] Error saving custom order file:', e)
  }
}

/**
 * Sorts an array of products based on a custom order array of product IDs.
 * Items not in the custom order are placed at the end while preserving their original order.
 */
export function sortProductsByOrder<T extends { id: string; name?: string }>(products: T[], orderIds?: string[]): T[] {
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return products
  }

  const orderMap = new Map<string, number>()
  orderIds.forEach((id, index) => {
    orderMap.set(String(id), index)
  })

  return [...products].sort((a, b) => {
    const indexA = orderMap.has(a.id)
      ? orderMap.get(a.id)!
      : a.name && orderMap.has(a.name)
      ? orderMap.get(a.name)!
      : 999999
    const indexB = orderMap.has(b.id)
      ? orderMap.get(b.id)!
      : b.name && orderMap.has(b.name)
      ? orderMap.get(b.name)!
      : 999999
    return indexA - indexB
  })
}
