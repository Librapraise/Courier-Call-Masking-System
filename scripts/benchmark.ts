import fs from 'node:fs'
try {
  const envText = fs.readFileSync('.env.local', 'utf-8')
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      const key = match[1]
      let value = (match[2] || '').trim()
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
      process.env[key] = value
    }
  })
} catch (e) {}

async function benchmark() {
  const { supabaseAdmin } = await import('../lib/supabase/server')
  const { ingestParsedDelivery } = await import('../lib/crm/ingestion-service')
  const { parseDeliveryMessage } = await import('../lib/crm/parser')
  console.log('--- STARTING PERFORMANCE BENCHMARK ---')
  
  // 1. Measure direct query to Supabase
  const t0 = Date.now()
  const { data: pingOrders } = await supabaseAdmin.from('crm_orders').select('id').limit(1)
  console.log(`⏱️ Ping crm_orders: ${Date.now() - t0}ms`)

  // 2. Measure dashboard multi-query
  const t1 = Date.now()
  const [ordersRes, brandsRes, productsRes] = await Promise.all([
    supabaseAdmin.from('crm_orders').select('id, address').limit(50),
    supabaseAdmin.from('brands').select('id, name'),
    supabaseAdmin.from('products').select('id, name, stock_on_hand')
  ])
  console.log(`⏱️ Parallel dashboard query: ${Date.now() - t1}ms`)

  // 3. Measure single order ingestion (Cold)
  const sample = `דרך הרימון 47 גינתון\n0525956159\n@test\n2 גרם קיי / 2g תפוז\n1000₪ כולל משלוח\nזיג זג`
  const parsed = parseDeliveryMessage(sample)
  const t2 = Date.now()
  const res = await ingestParsedDelivery(parsed)
  console.log(`⏱️ Cold Ingest parsed delivery: ${Date.now() - t2}ms (Success: ${res.success})`)

  // 4. Measure warm ingestion (repeated with cache)
  const t3 = Date.now()
  const resWarm = await ingestParsedDelivery(parsed)
  console.log(`⏱️ Warm Ingest parsed delivery: ${Date.now() - t3}ms (Success: ${resWarm.success})`)

  // 5. Cleanup test benchmark orders
  const { data: testOrders } = await supabaseAdmin.from('crm_orders').select('id').eq('address', 'דרך הרימון 47 גינתון')
  if (testOrders && testOrders.length > 0) {
    const ids = testOrders.map((o: any) => o.id)
    await supabaseAdmin.from('inventory_transactions').delete().in('order_id', ids)
    await supabaseAdmin.from('crm_orders').delete().in('id', ids)
    console.log(`🧹 Cleaned up ${ids.length} benchmark test order records.`)
  }
}

benchmark().catch(console.error)
