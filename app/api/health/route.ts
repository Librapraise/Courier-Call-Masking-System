import { NextResponse } from 'next/server'
import twilio from 'twilio'

/**
 * Health check endpoint
 * Verifies Twilio connection and system status
 */
export async function GET() {
  console.log('[API] /api/health - Health check requested')
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

    const checks = {
      twilio_configured: !!(accountSid && authToken && twilioPhoneNumber),
      twilio_connected: false,
      database_connected: false,
      timestamp: new Date().toISOString(),
    }

    console.log('[API] /api/health - Twilio configuration check:', checks.twilio_configured)

    // Test Twilio connection
    if (checks.twilio_configured && accountSid && authToken) {
      try {
        const client = twilio(accountSid, authToken)
        // Try to fetch account info (lightweight operation)
        await client.api.accounts(accountSid).fetch()
        checks.twilio_connected = true
        console.log('[API] /api/health - Twilio connection test: SUCCESS')
      } catch (error) {
        console.error('[API] /api/health - Twilio connection test failed:', error)
        checks.twilio_connected = false
      }
    }

    // Test database connection
    try {
      const { supabaseAdmin } = await import('@/lib/supabase/server')
      const { error } = await supabaseAdmin.from('settings').select('key').limit(1)
      checks.database_connected = !error
      if (error) {
        console.error('[API] /api/health - Database connection test failed:', error)
      } else {
        console.log('[API] /api/health - Database connection test: SUCCESS')
      }
    } catch (error) {
      console.error('[API] /api/health - Database connection test failed:', error)
      checks.database_connected = false
    }

    const isHealthy = checks.twilio_configured && checks.twilio_connected && checks.database_connected

    console.log('[API] /api/health - Health check completed:', {
      isHealthy,
      checks
    })

    return NextResponse.json(checks, {
      status: isHealthy ? 200 : 503,
    })
  } catch (error: any) {
    console.error('[API] /api/health - Health check error:', error.message || error)
    return NextResponse.json(
      {
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

