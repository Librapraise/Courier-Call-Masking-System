import fs from 'node:fs'
import path from 'node:path'

const COSTS_FILE = path.join(process.cwd(), 'data', 'product_costs.json')

export function getLocalProductCosts(): Record<string, number> {
  try {
    if (fs.existsSync(COSTS_FILE)) {
      const content = fs.readFileSync(COSTS_FILE, 'utf-8')
      return JSON.parse(content) || {}
    }
  } catch (e) {}
  return {}
}

export function saveLocalProductCost(productIdOrName: string, cost: number): void {
  try {
    const dir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const current = getLocalProductCosts()
    current[productIdOrName] = cost
    fs.writeFileSync(COSTS_FILE, JSON.stringify(current, null, 2), 'utf-8')
  } catch (e) {}
}

export function saveLocalProductCostsBatch(costMap: Record<string, number>): void {
  try {
    const dir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const current = getLocalProductCosts()
    const updated = { ...current, ...costMap }
    fs.writeFileSync(COSTS_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  } catch (e) {}
}
