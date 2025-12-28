import cron from 'node-cron'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Daily reset cron job
 * Runs at midnight Israel time (Asia/Jerusalem)
 * Archives data and clears customer list
 */
export function startDailyResetCron() {
  // Schedule for midnight Israel time (00:00 Asia/Jerusalem)
  // Cron format: minute hour day month day-of-week
  // Using 0 0 * * * for midnight, but we need to handle timezone
  // Note: node-cron uses server timezone, so we'll use a workaround
  // For production, consider using a timezone-aware scheduler or API route
  
  // Schedule at 22:00 UTC (which is 00:00 Israel time during standard time)
  // During DST, Israel is UTC+3, so 21:00 UTC = 00:00 Israel
  // We'll use 21:00 UTC to cover both (slight offset during standard time)
  const cronSchedule = '0 21 * * *' // 21:00 UTC = 00:00 Israel (approximately)

  console.log('Starting daily reset cron job (scheduled for midnight Israel time)')

  cron.schedule(cronSchedule, async () => {
    try {
      console.log('Running daily reset job...')
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      if (!appUrl) {
        console.error('APP_URL not configured, cannot run daily reset')
        return
      }

      // Call the reset API endpoint
      const resetUrl = `${appUrl}/api/admin/reset`
      const cronSecret = process.env.CRON_SECRET

      const response = await fetch(resetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cron-Secret': cronSecret || '',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('Daily reset failed:', error)
      } else {
        const result = await response.json()
        console.log('Daily reset completed:', result)
      }
    } catch (error) {
      console.error('Error in daily reset cron job:', error)
    }
  })

  console.log('Daily reset cron job scheduled')
}

/**
 * Get next reset time based on settings
 */
export async function getNextResetTime(): Promise<Date | null> {
  try {
    const { data: timeSetting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'daily_reset_time')
      .single()

    const { data: timezoneSetting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'daily_reset_timezone')
      .single()

    const resetTime = timeSetting?.value || '00:00'
    const timezone = timezoneSetting?.value || 'Asia/Jerusalem'

    // Parse time (HH:MM format)
    const [hours, minutes] = resetTime.split(':').map(Number)
    
    // Calculate next reset time
    const now = new Date()
    const nextReset = new Date()
    nextReset.setHours(hours, minutes, 0, 0)
    
    // If time has passed today, schedule for tomorrow
    if (nextReset <= now) {
      nextReset.setDate(nextReset.getDate() + 1)
    }

    return nextReset
  } catch (error) {
    console.error('Error getting next reset time:', error)
    return null
  }
}

