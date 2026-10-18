import { supabaseAdmin } from '../supabase/server'
import { ParsedDeliveryOrder } from './parser'
import { formatPhoneForStorage } from '../utils/phone'
import { invalidateDashboardCache } from './cache'

export interface IngestionResult {
  success: boolean
  customerId?: string
  orderId?: string
  error?: string
  orderSummary?: {
    address: string
    brand: string
    price: number
    deductions: { productName: string; quantity: number; unit: string }[]
  }
}

// In-memory brand cache to avoid redundant database queries during batch ingestion
const brandCache = new Map<string, string>()

// In-memory product metadata cache (60 seconds TTL)
interface ProductCacheItem {
  id: string
  name: string
  unit: string
  stock_on_hand: number
}
let cachedProductsMap: Map<string, ProductCacheItem> | null = null
let productsCacheExpiry = 0

async function getCachedProducts(): Promise<Map<string, ProductCacheItem>> {
  const now = Date.now()
  if (!cachedProductsMap || now > productsCacheExpiry) {
    const { data: prods } = await supabaseAdmin
      .from('products')
      .select('id, name, unit, stock_on_hand')

    cachedProductsMap = new Map(
      (prods || []).map(p => [
        p.name,
        {
          id: p.id,
          name: p.name,
          unit: p.unit,
          stock_on_hand: Number(p.stock_on_hand) || 0
        }
      ])
    )
    productsCacheExpiry = now + 60000 // 60s TTL
  }
  return cachedProductsMap
}

/**
 * Non-blocking legacy customer sync for Twilio call-masking.
 * Runs in background without stalling order ingestion or dispatcher confirmations.
 */
function syncLegacyCustomerNonBlocking(customerName: string, rawPhone: string) {
  (async () => {
    try {
      const normalizedPhone = formatPhoneForStorage(rawPhone)
      const cleanPhone = (rawPhone || '').replace(/\D/g, '')
      const last9 = cleanPhone.slice(-9)

      const { data: matchedLegacy } = await supabaseAdmin
        .from('customers')
        .select('id')
        .or(`phone_number.eq.${normalizedPhone},phone_number.ilike.%${last9}`)
        .limit(1)
        .maybeSingle()

      if (matchedLegacy) {
        await supabaseAdmin
          .from('customers')
          .update({
            name: customerName,
            phone_number: normalizedPhone,
            is_active: true,
            is_completed: false
          })
          .eq('id', matchedLegacy.id)
      } else {
        await supabaseAdmin
          .from('customers')
          .insert({
            name: customerName,
            phone_number: normalizedPhone,
            is_active: true,
            is_completed: false
          })
      }
    } catch (syncErr) {
      console.warn('[Ingest] Legacy customer sync background note:', syncErr)
    }
  })().catch(() => {})
}

/**
 * Ingests a single parsed delivery into Supabase:
 * 1. Finds or creates Brand record (with in-memory cache)
 * 2. Resolves Customer ID (fast indexed lookup or insert)
 * 3. Creates Order record & updates Customer in parallel
 * 4. Deducts warehouse stock using cached product metadata in parallel
 * 5. Syncs legacy Twilio customer asynchronously in background
 */
export async function ingestParsedDelivery(parsed: ParsedDeliveryOrder): Promise<IngestionResult> {
  try {
    if (!parsed.phoneNumber) {
      return { success: false, error: 'Missing phone number in delivery message' }
    }

    // 1. Get or create Brand ID (using fast cache)
    let brandId: string | null = brandCache.get(parsed.brand) || null

    if (!brandId) {
      const { data: existingBrand } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('name', parsed.brand)
        .maybeSingle()

      if (existingBrand?.id) {
        brandId = existingBrand.id
        brandCache.set(parsed.brand, existingBrand.id)
      } else {
        const { data: newBrand, error: brandInsertError } = await supabaseAdmin
          .from('brands')
          .insert({ name: parsed.brand })
          .select('id')
          .single()

        if (brandInsertError) {
          console.error('[Ingest] Error creating brand:', brandInsertError)
        } else if (newBrand?.id) {
          brandId = newBrand.id
          brandCache.set(parsed.brand, newBrand.id)
        }
      }
    }

    if (!brandId) {
      const { data: fallbackBrand } = await supabaseAdmin.from('brands').select('id').limit(1).single()
      brandId = fallbackBrand?.id || null
    }

    // 2. Resolve Customer ID
    const { data: existingCust } = await supabaseAdmin
      .from('crm_customers')
      .select('id, total_orders, total_spent')
      .eq('phone_number', parsed.phoneNumber)
      .maybeSingle()

    let customerId: string
    let customerUpdatePromise: Promise<any> | null = null

    if (existingCust) {
      customerId = existingCust.id
      const newTotalOrders = (existingCust.total_orders || 0) + 1
      const newTotalSpent = Number(existingCust.total_spent || 0) + Number(parsed.totalPrice || 0)

      // Will execute concurrently with order insertion
      customerUpdatePromise = Promise.resolve(
        supabaseAdmin
          .from('crm_customers')
          .update({
            address_name: parsed.customerName,
            city: parsed.city,
            telegram_handle: parsed.telegramHandle || undefined,
            customer_type: parsed.customerType,
            total_orders: newTotalOrders,
            total_spent: newTotalSpent,
            last_brand_id: brandId,
            last_order_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', customerId)
      )
    } else {
      const { data: newCust, error: custError } = await supabaseAdmin
        .from('crm_customers')
        .insert({
          address_name: parsed.customerName,
          city: parsed.city,
          phone_number: parsed.phoneNumber,
          telegram_handle: parsed.telegramHandle,
          customer_type: parsed.customerType,
          total_orders: 1,
          total_spent: parsed.totalPrice || 0,
          last_brand_id: brandId,
          last_order_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (custError || !newCust) {
        throw new Error(`Customer creation error: ${custError?.message}`)
      }
      customerId = newCust.id
    }

    // Fire legacy sync non-blocking in background
    syncLegacyCustomerNonBlocking(parsed.customerName, parsed.phoneNumber)

    // 3. Create Order record (concurrently with customer update if applicable)
    const basePayload = {
      customer_id: customerId,
      brand_id: brandId,
      address: parsed.customerName,
      city: parsed.city,
      menu_items: parsed.menuItems,
      actual_items: parsed.actualItems,
      total_price: parsed.totalPrice,
      is_settled: false,
      raw_message: parsed.rawText,
      order_date: new Date().toISOString()
    }

    const orderInsertPromise = Promise.resolve(
      supabaseAdmin
        .from('crm_orders')
        .insert({
          ...basePayload,
          payment_method: parsed.paymentMethod,
          is_prepaid: parsed.isPrepaid
        })
        .select('id')
        .single()
    )

    const [orderRes] = await Promise.all([
      orderInsertPromise,
      customerUpdatePromise ? customerUpdatePromise : Promise.resolve({ data: null, error: null })
    ])

    let newOrder = orderRes.data
    if (orderRes.error || !newOrder) {
      // Fallback in case payment_method column missing
      const { data: fallbackOrder, error: fallbackErr } = await supabaseAdmin
        .from('crm_orders')
        .insert(basePayload)
        .select('id')
        .single()
      if (fallbackErr || !fallbackOrder) {
        throw new Error(`Order creation error: ${fallbackErr?.message}`)
      }
      newOrder = fallbackOrder
    }

    const orderId = newOrder.id

    // 4. Process Inventory Deductions using cached product catalog
    const executedDeductions: { productName: string; quantity: number; unit: string }[] = []

    if (parsed.deductions.length > 0) {
      const prodMap = await getCachedProducts()

      const deductionPromises = parsed.deductions.map(async (d) => {
        const prod = prodMap.get(d.warehouseProductName)
        if (!prod) return null

        const currentStock = prod.stock_on_hand
        const updatedStock = Math.max(0, currentStock - Math.abs(d.quantity))
        prod.stock_on_hand = updatedStock // update in-memory cache instantly

        await Promise.all([
          supabaseAdmin.from('inventory_transactions').insert({
            product_id: prod.id,
            order_id: orderId,
            quantity: -Math.abs(d.quantity),
            reason: 'DISPATCH_DEDUCTION',
            notes: `Deduction from order ${orderId}`
          }),
          supabaseAdmin
            .from('products')
            .update({
              stock_on_hand: updatedStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', prod.id)
        ])

        return {
          productName: prod.name,
          quantity: d.quantity,
          unit: prod.unit
        }
      })

      const results = await Promise.all(deductionPromises)
      results.forEach(r => {
        if (r) executedDeductions.push(r)
      })
    }

    // Invalidate dashboard memory cache so the very next CRM poll or fetch sees this instantly!
    invalidateDashboardCache()

    return {
      success: true,
      customerId,
      orderId,
      orderSummary: {
        address: parsed.customerName,
        brand: parsed.brand,
        price: parsed.totalPrice,
        deductions: executedDeductions
      }
    }
  } catch (err: any) {
    console.error('[Ingest] Transaction failed:', err)
    return { success: false, error: err.message }
  }
}
