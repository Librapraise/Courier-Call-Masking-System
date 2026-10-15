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

const supabase = createClient(
  envVars['NEXT_PUBLIC_SUPABASE_URL'] || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  envVars['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  const { data, error } = await supabase.from('crm_orders').select('*').limit(1)
  if (error) {
    console.error('Error querying crm_orders:', error.message)
    return
  }
  if (data && data[0]) {
    console.log('Columns in crm_orders:', Object.keys(data[0]))
    console.log('Sample order:', data[0])
  } else {
    console.log('No rows in crm_orders or empty table')
  }
}

check()
