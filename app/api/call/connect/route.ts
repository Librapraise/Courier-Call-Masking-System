import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { validateTwilioWebhook } from '@/lib/twilio/webhook'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Handles the call connection webhook
 * When courier answers, connects them to the customer with caller ID masking
 */
export async function POST(request: NextRequest) {
  console.log('[API] /api/call/connect - Connect webhook called by Twilio')
  try {
    // Note: This webhook is called by Twilio as part of our controlled call flow
    // Validation is handled in incoming/status webhooks which receive external requests

    const { searchParams } = new URL(request.url)
    const customerPhone = searchParams.get('customerPhone')
    const customerId = searchParams.get('customerId')
    const courierId = searchParams.get('courierId')

    console.log('[API] /api/call/connect - Webhook parameters:', { customerId, courierId, hasCustomerPhone: !!customerPhone })

    if (!customerPhone) {
      console.error('[API] /api/call/connect - Missing customer phone number')
      return NextResponse.json({ error: 'Customer phone number required' }, { status: 400 })
    }

    // Get business phone number from settings or env
    const { data: setting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'business_phone_number')
      .single()

    const businessPhone = setting?.value || process.env.TWILIO_PHONE_NUMBER

    console.log('[API] /api/call/connect - Connecting call:', {
      customerPhone,
      businessPhone,
      callerId: businessPhone
    })

    // TwiML to connect the call
    // When courier answers, connect them to the customer
    const twiml = new twilio.twiml.VoiceResponse()
    
    // Dial the customer's phone number with caller ID masking
    // Customer will see the business number, not the courier's real number
    const dial = twiml.dial({
      callerId: businessPhone, // Mask caller ID to show business number
      record: 'do-not-record', // Don't record calls by default
    })
    dial.number(customerPhone)

    console.log('[API] /api/call/connect - TwiML generated, connecting courier to customer')
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('[API] /api/call/connect - Error in connect webhook:', error.message || error)
    
    // Return error TwiML
    const twiml = new twilio.twiml.VoiceResponse()
    twiml.say('Sorry, there was an error connecting your call.')
    twiml.hangup()
    
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}

