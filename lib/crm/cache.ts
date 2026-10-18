/**
 * GhostCRM High-Performance Memory Cache & Invalidation Store
 * Provides sub-millisecond data retrieval for active CRM dashboards and Telegram ingestion.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const memoryStore = new Map<string, CacheEntry<any>>()

export function getCached<T>(key: string): T | null {
  const entry = memoryStore.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > entry.ttl) {
    memoryStore.delete(key)
    return null
  }
  return entry.data as T
}

export function setCached<T>(key: string, data: T, ttlMs: number = 3000): void {
  memoryStore.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  })
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memoryStore.clear()
    return
  }
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key)
    }
  }
}

export function invalidateDashboardCache(): void {
  invalidateCache('crm_dashboard')
  invalidateCache('active_orders')
}
