import { supabaseAdmin } from '../supabase/server'

// Generate a random 6-character slug (letters and numbers)
export function generateRandomSlug(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Generate a slug and ensure it is unique within the customers table
export async function generateUniqueFeedbackSlug(): Promise<string> {
  let attempts = 0
  while (attempts < 10) {
    const slug = generateRandomSlug()
    
    // Check if slug exists in customers table
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('feedback_slug', slug)
      .maybeSingle()
      
    if (!error && !data) {
      return slug
    }
    attempts++
  }
  
  // Fallback to random + unique timestamp suffix if collision persists
  return generateRandomSlug() + Date.now().toString().slice(-4)
}
