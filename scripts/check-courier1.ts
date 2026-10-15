import './load-env'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: couriers } = await supabase.from('crm_couriers').select('*')
  console.log('All couriers:', couriers?.map(c => ({ id: c.id, name: c.name, phone: c.phone_number })))

  const courier1 = couriers?.find(c => c.name.includes('שליח 1') || c.name.includes('1'))
  console.log('Courier 1 found:', courier1)

  if (courier1) {
    const { data: orders } = await supabase
      .from('crm_orders')
      .select('id, order_date, total_price, city, address, is_settled, created_at')
      .eq('courier_id', courier1.id)
      .order('created_at', { ascending: false })
      .limit(15)
    console.log('Courier 1 orders count:', orders?.length)
    console.log('Courier 1 orders:', orders)

    const { data: settlements } = await supabase
      .from('cash_settlements')
      .select('*')
      .eq('courier_id', courier1.id)
      .order('created_at', { ascending: false })
      .limit(5)
    console.log('Courier 1 settlements:', settlements)
  }

  const { data: closeout } = await supabase
    .from('crm_day_closeouts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
  console.log('Latest closeout couriers_summary:', JSON.stringify(closeout?.[0]?.couriers_summary, null, 2))
}

main().catch(console.error)
