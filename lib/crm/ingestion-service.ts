import { supabaseAdmin } from '../supabase/server'
import { ParsedDeliveryOrder } from './parser'
import { formatPhoneForStorage } from '../utils/phone'

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

/**
 * Ingests a single parsed delivery into Supabase:
 * 1. Finds or creates Brand record
 * 2. Upserts Customer by unique phone_number (Customer Name = Address)
 * 3. Creates Order record (captures menuItems vs actualItems)
 * 4. Deducts warehouse product stock and logs inventory_transactions
 */
export async function ingestParsedDelivery(parsed: ParsedDeliveryOrder): Promise<IngestionResult> {
  try {
    if (!parsed.phoneNumber) {
      return { success: false, error: 'Missing phone number in delivery message' }
    }

    // 1. Get or create Brand ID
    let brandId: string | null = null
    const { data: existingBrand } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('name', parsed.brand)
      .maybeSingle()

    if (existingBrand) {
      brandId = existingBrand.id
    } else {
      const { data: newBrand, error: brandInsertError } = await supabaseAdmin
        .from('brands')
        .insert({ name: parsed.brand })
        .select('id')
        .single()

      if (brandInsertError) {
        console.error('[Ingest] Error creating brand:', brandInsertError)
      } else {
        brandId = newBrand.id
      }
    }

    // Fallback if brand still not resolved
    if (!brandId) {
      const { data: fallbackBrand } = await supabaseAdmin.from('brands').select('id').limit(1).single()
      brandId = fallbackBrand?.id || null
    }

    // 2. Upsert Customer by Phone Number (Deterministic Identity)
    const { data: existingCust } = await supabaseAdmin
      .from('crm_customers')
      .select('id, total_orders, total_spent')
      .eq('phone_number', parsed.phoneNumber)
      .maybeSingle()

    let customerId: string

    if (existingCust) {
      customerId = existingCust.id
      const newTotalOrders = (existingCust.total_orders || 0) + 1
      const newTotalSpent = Number(existingCust.total_spent || 0) + Number(parsed.totalPrice || 0)

      await supabaseAdmin
        .from('crm_customers')
        .update({
          address_name: parsed.customerName, // Update with most recent delivery address
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

    // Also sync to legacy customers table for the Twilio Call-Masking Courier App
    try {
      const normalizedPhone = formatPhoneForStorage(parsed.phoneNumber)
      const cleanPhone = (parsed.phoneNumber || '').replace(/\D/g, '')

      const { data: legacyCusts } = await supabaseAdmin
        .from('customers')
        .select('id, phone_number')

      const matchedLegacy = (legacyCusts || []).find(c => {
        const cClean = (c.phone_number || '').replace(/\D/g, '')
        return cClean && cleanPhone && (cClean.endsWith(cleanPhone.slice(-9)) || cleanPhone.endsWith(cClean.slice(-9)))
      })

      if (matchedLegacy) {
        await supabaseAdmin
          .from('customers')
          .update({
            name: parsed.customerName,
            phone_number: normalizedPhone,
            is_active: true,
            is_completed: false
          })
          .eq('id', matchedLegacy.id)
      } else {
        await supabaseAdmin
          .from('customers')
          .insert({
            name: parsed.customerName,
            phone_number: normalizedPhone,
            is_active: true,
            is_completed: false
          })
      }
    } catch (syncErr) {
      console.warn('[Ingest] Legacy customer sync note:', syncErr)
    }

    // 3. Create Order record
    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('crm_orders')
      .insert({
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
      })
      .select('id')
      .single()

    if (orderError || !newOrder) {
      throw new Error(`Order creation error: ${orderError?.message}`)
    }

    const orderId = newOrder.id

    // 4. Process Inventory Deductions
    const executedDeductions: { productName: string; quantity: number; unit: string }[] = []

    for (const d of parsed.deductions) {
      // Find matching product in database
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('id, name, unit, stock_on_hand')
        .eq('name', d.warehouseProductName)
        .maybeSingle()

      if (prod) {
        // Record negative inventory transaction
        await supabaseAdmin.from('inventory_transactions').insert({
          product_id: prod.id,
          order_id: orderId,
          quantity: -Math.abs(d.quantity),
          reason: 'DISPATCH_DEDUCTION',
          notes: `Deduction from order ${orderId}`
        })

        // Decrement live product stock_on_hand
        const currentStock = Number(prod.stock_on_hand) || 0
        const updatedStock = Math.max(0, currentStock - Math.abs(d.quantity))

        await supabaseAdmin
          .from('products')
          .update({
            stock_on_hand: updatedStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', prod.id)

        executedDeductions.push({
          productName: prod.name,
          quantity: d.quantity,
          unit: prod.unit
        })
      }
    }

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
