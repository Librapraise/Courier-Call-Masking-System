import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      envVars[key] = val
    }
  }
})

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'] || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testConnection() {
  console.log('Testing Supabase connection to:', supabaseUrl)
  try {
    const { data, error } = await supabase.from('profiles').select('id, email, role').limit(5)
    if (error) {
      console.error('Error querying profiles:', error.message)
    } else {
      console.log('Profiles table connected successfully! Found records:', data?.length)
    }

    // Check if brands table exists
    const { data: brands, error: brandsError } = await supabase.from('brands').select('id, name').limit(5)
    if (brandsError) {
      console.log('Brands table status:', brandsError.message)
    } else {
      console.log('Brands table exists! Current count:', brands?.length)
    }

    // Check if products table exists
    const { data: products, error: productsError } = await supabase.from('products').select('id, name').limit(5)
    if (productsError) {
      console.log('Products table status:', productsError.message)
    } else {
      console.log('Products table exists! Current count:', products?.length)
    }
  } catch (err: any) {
    console.error('Fatal connection error:', err.message)
  }
}

testConnection()
