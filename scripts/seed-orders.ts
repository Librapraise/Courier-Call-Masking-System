import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      envVars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
    }
  }
})

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'] || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedOrders() {
  console.log('--- Checking & Seeding Orders & Customers ---')
  
  // 1. Check existing orders
  const { data: existingOrders, count } = await supabase
    .from('crm_orders')
    .select('id', { count: 'exact' })
  
  console.log(`Current orders in DB: ${count || 0}`)
  
  // 2. Fetch brands
  const { data: brands } = await supabase.from('brands').select('id, name')
  if (!brands || brands.length === 0) {
    console.error('No brands found in DB. Make sure brands are seeded.')
    return
  }
  
  // 3. Fetch couriers or create defaults
  let { data: couriers } = await supabase.from('crm_couriers').select('id, name')
  if (!couriers || couriers.length === 0) {
    console.log('Seeding default couriers...')
    const defaultCouriers = [
      { name: 'יצחק הגנן הסדרן', phone_number: '054-9988771', is_active: true },
      { name: 'Zig zag מנהל', phone_number: '052-8877662', is_active: true },
      { name: 'דני שליחויות מרכז', phone_number: '050-1122334', is_active: true },
      { name: 'יוסי אקספרס דרום', phone_number: '053-4455667', is_active: true }
    ]
    const { data: insertedCouriers, error: courierErr } = await supabase
      .from('crm_couriers')
      .insert(defaultCouriers)
      .select()
    if (courierErr) console.error('Error inserting couriers:', courierErr.message)
    couriers = insertedCouriers || []
  }

  // 4. Sample realistic orders across major Israeli cities
  const sampleDeliveries = [
    {
      customerName: 'מרקו לויז - הנשיאים 57 פתח תקווה',
      city: 'פתח תקווה',
      phone: '054-9777288',
      telegram: '@marco_leviz',
      type: 'קבוע',
      brandName: 'אמריקה ישראל',
      menuItems: '2 גלאטו 33, 2 אלסקה, 2 בראון',
      actualItems: '20g רפואי האני, 20g רפואי מלון, 20g רפואי גלאקסי',
      price: 3000,
      courierIdx: 0,
      settled: false
    },
    {
      customerName: 'רמבם 56 ראשון לציון',
      city: 'ראשון לציון',
      phone: '053-3311222',
      telegram: '@rambam_56',
      type: 'קבוע',
      brandName: 'פופקורן',
      menuItems: '2 פופקורן סגול / 20 כתום',
      actualItems: '20g פופקורן כתום',
      price: 1800,
      courierIdx: 1,
      settled: false
    },
    {
      customerName: 'לשפר 18 תל אביב',
      city: 'תל אביב',
      phone: '052-8889900',
      telegram: '@tlv_leShefer',
      type: 'VIP',
      brandName: 'רפואי',
      menuItems: '1 גלאטו 33/ 10 רפואי דקסטר',
      actualItems: '10g רפואי דקסטר',
      price: 950,
      courierIdx: 0,
      settled: true
    },
    {
      customerName: 'סמטת העליה 6 בני עייש',
      city: 'בני עייש',
      phone: '050-1234567',
      telegram: '@ayish_guy',
      type: 'חדש',
      brandName: 'ביטים',
      menuItems: '1 בירדיי קייק / 10g ביטים בירדיי',
      actualItems: '10g ביטים בירדיי קייק',
      price: 600,
      courierIdx: 2,
      settled: false
    },
    {
      customerName: 'הבנים 12 חולון',
      city: 'חולון',
      phone: '054-1122334',
      telegram: '@holon_vip',
      type: 'קבוע',
      brandName: 'שמן',
      menuItems: '2 שמן סאטיבה',
      actualItems: '2 units שמן קנאביס סאטיבה',
      price: 700,
      courierIdx: 1,
      settled: false
    },
    {
      customerName: 'דיזנגוף 104 תל אביב',
      city: 'תל אביב',
      phone: '054-5566778',
      telegram: '@dizengoff104',
      type: 'קבוע',
      brandName: 'קאלי יבוא',
      menuItems: '1 למנייד יבוא / 10g למנייד',
      actualItems: '10g למנייד יבוא',
      price: 1100,
      courierIdx: 0,
      settled: true
    },
    {
      customerName: 'ביאליק 22 רמת גן',
      city: 'רמת גן',
      phone: '052-1234888',
      telegram: '@bialik_rg',
      type: 'חדש',
      brandName: 'וייפ',
      menuItems: '2 עטי אידוי',
      actualItems: '2 units עט אידוי',
      price: 850,
      courierIdx: 2,
      settled: false
    },
    {
      customerName: 'סוקולוב 15 הרצליה',
      city: 'הרצליה',
      phone: '053-4455667',
      telegram: '@herzliya_p',
      type: 'VIP',
      brandName: 'אוראו',
      menuItems: '3 אוראו כחול, 1 חמצוצים',
      actualItems: '3 units אוראו כחול, 1 units חמצוצים',
      price: 650,
      courierIdx: 0,
      settled: false
    },
    {
      customerName: 'שדרות ירושלים 8 אשדוד',
      city: 'אשדוד',
      phone: '050-3322114',
      telegram: '@ashdod_boss',
      type: 'קבוע',
      brandName: 'חשיש',
      menuItems: '1 פיתת חשיש רגיל',
      actualItems: '1 units פיתות חשיש רגיל',
      price: 1400,
      courierIdx: 3,
      settled: false
    },
    {
      customerName: 'ויצמן 30 כפר סבא',
      city: 'כפר סבא',
      phone: '054-7788990',
      telegram: '@kfar_saba_reg',
      type: 'קבוע',
      brandName: 'תפזורת',
      menuItems: '1 תפזורת בוטיק 20g',
      actualItems: '20g תפזורת בוטיק',
      price: 1200,
      courierIdx: 2,
      settled: true
    },
    {
      customerName: 'הרב קוק 14 ירושלים',
      city: 'ירושלים',
      phone: '052-3344556',
      telegram: '@jerusalem_gold',
      type: 'VIP',
      brandName: 'רפואי',
      menuItems: '20 רפואי האני',
      actualItems: '20g רפואי האני',
      price: 1600,
      courierIdx: 1,
      settled: false
    },
    {
      customerName: 'העצמאות 44 בת ים',
      city: 'בת ים',
      phone: '050-9988776',
      telegram: '@batyam_club',
      type: 'קבוע',
      brandName: 'גת',
      menuItems: '2 מיצוי גת אדום, 1 בקבוק גת',
      actualItems: '2 units מיצוי גת אדום, 1 units בקבוק מיץ גת',
      price: 450,
      courierIdx: 1,
      settled: false
    }
  ]

  console.log(`Seeding ${sampleDeliveries.length} demonstration delivery orders across Israeli cities...`)
  
  for (const del of sampleDeliveries) {
    // Find matching brand or use first
    const brand = brands.find(b => b.name.includes(del.brandName) || del.brandName.includes(b.name)) || brands[0]
    const courier = (couriers && couriers[del.courierIdx % couriers.length]) || null
    
    // 1. Upsert customer
    const { data: customer, error: custErr } = await supabase
      .from('crm_customers')
      .upsert({
        address_name: del.customerName,
        city: del.city,
        phone_number: del.phone,
        telegram_handle: del.telegram,
        customer_type: del.type,
        total_orders: 1,
        total_spent: del.price,
        last_brand_id: brand.id,
        last_order_at: new Date().toISOString()
      }, { onConflict: 'phone_number' })
      .select('id')
      .single()

    if (custErr) {
      console.warn(`Error upserting customer ${del.phone}:`, custErr.message)
      continue
    }

    // 2. Insert order
    const { error: orderErr } = await supabase
      .from('crm_orders')
      .insert({
        customer_id: customer.id,
        brand_id: brand.id,
        courier_id: courier ? courier.id : null,
        address: del.customerName,
        city: del.city,
        menu_items: del.menuItems,
        actual_items: del.actualItems,
        total_price: del.price,
        is_settled: del.settled,
        raw_message: `Sample delivery for ${del.customerName} - ${del.price}₪`,
        order_date: new Date().toISOString()
      })

    if (orderErr) {
      console.warn(`Error inserting order for ${del.customerName}:`, orderErr.message)
    }
  }

  console.log('✅ Seeding completed successfully!')
}

async function purgeOrders() {
  console.log('⚠️ --- PURGING DEMO ORDERS, CUSTOMERS & SETTLEMENTS ---')
  console.log('Preserving catalog brands, warehouse products stock, and couriers...')

  const { error: txErr } = await supabase.from('inventory_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (txErr) console.warn('Error clearing inventory_transactions:', txErr.message)

  const { error: orderErr } = await supabase.from('crm_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (orderErr) console.warn('Error clearing crm_orders:', orderErr.message)

  const { error: settleErr } = await supabase.from('cash_settlements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (settleErr) console.warn('Error clearing cash_settlements:', settleErr.message)

  const { error: custErr } = await supabase.from('crm_customers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (custErr) console.warn('Error clearing crm_customers:', custErr.message)

  console.log('✅ All demo data wiped clean! Database is ready for live Telegram forwarding.')
}

const isPurge = process.argv.includes('--purge')

if (isPurge) {
  purgeOrders()
} else {
  seedOrders()
}
