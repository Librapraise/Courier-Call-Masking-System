import { NextResponse } from 'next/server'
import twilio from 'twilio'

/**
 * Health check endpoint
 * Verifies Twilio connection and system status
 */
export async function GET() {
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

    // Test Twilio connection
    if (checks.twilio_configured) {
      try {
        const client = twilio(accountSid, authToken)
        // Try to fetch account info (lightweight operation)
        await client.api.accounts(accountSid).fetch()
        checks.twilio_connected = true
      } catch (error) {
        console.error('Twilio connection test failed:', error)
        checks.twilio_connected = false
      }
    }

    // Test database connection
    try {
      const { supabaseAdmin } = await import('@/lib/supabase/server')
      const { error } = await supabaseAdmin.from('settings').select('key').limit(1)
      checks.database_connected = !error
    } catch (error) {
      console.error('Database connection test failed:', error)
      checks.database_connected = false
    }

    const isHealthy = checks.twilio_configured && checks.twilio_connected && checks.database_connected

    return NextResponse.json(checks, {
      status: isHealthy ? 200 : 503,
    })
  } catch (error: any) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

