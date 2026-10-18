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

async function check() {
  const { supabaseAdmin } = await import('../lib/supabase/server')
  const { data, error } = await supabaseAdmin.from('products').select('id, name, cost_per_unit').limit(1)
  if (error) {
    console.log('Column cost_per_unit does not exist yet:', error.message)
  } else {
    console.log('Column cost_per_unit exists! Sample row:', data)
  }
}
check().catch(console.error)
