import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { validateTwilioWebhook } from '@/lib/twilio/webhook'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Shared logic for handling connect webhook (both GET and POST)
 */
async function handleConnectWebhook(request: NextRequest) {
  console.log('[API] /api/call/connect - Connect webhook called by Twilio')
  console.log('[API] /api/call/connect - Request URL:', request.url)
  console.log('[API] /api/call/connect - Request method:', request.method)
  
  // Always return TwiML, even on errors, to prevent Twilio from playing "application error"
  let twiml: twilio.twiml.VoiceResponse
  
  try {
    // Use request.nextUrl for proper URL parsing in Next.js
    const customerPhone = request.nextUrl.searchParams.get('customerPhone')
    const customerId = request.nextUrl.searchParams.get('customerId')
    const courierId = request.nextUrl.searchParams.get('courierId')

    console.log('[API] /api/call/connect - Webhook parameters:', { 
      customerId, 
      courierId, 
      hasCustomerPhone: !!customerPhone,
      customerPhone: customerPhone ? `${customerPhone.substring(0, 4)}****` : null // Log masked phone
    })

    if (!customerPhone) {
      console.error('[API] /api/call/connect - Missing customer phone number')
      twiml = new twilio.twiml.VoiceResponse()
      twiml.say('Sorry, there was an error connecting your call. The customer phone number is missing.')
      twiml.hangup()
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
        },
      })
    }

    // Validate phone number format (E.164)
    if (!customerPhone.startsWith('+')) {
      console.error('[API] /api/call/connect - Invalid phone number format (must be E.164):', customerPhone)
      twiml = new twilio.twiml.VoiceResponse()
      twiml.say('Sorry, there was an error connecting your call. Invalid phone number format.')
      twiml.hangup()
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
        },
      })
    }

    // Get business phone number from settings or env
    let businessPhone = process.env.TWILIO_PHONE_NUMBER
    
    if (!businessPhone) {
      console.error('[API] /api/call/connect - TWILIO_PHONE_NUMBER not set in environment')
    } else {
      console.log('[API] /api/call/connect - Business phone from env:', businessPhone)
    }
    
    // Try to get from settings, but don't fail if it times out or errors
    try {
      const settingsResult = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'business_phone_number')
        .single()

      if (!settingsResult.error && settingsResult.data?.value) {
        businessPhone = settingsResult.data.value
        console.log('[API] /api/call/connect - Business phone from settings:', businessPhone)
      } else if (settingsResult.error) {
        console.warn('[API] /api/call/connect - Settings query error (non-critical):', settingsResult.error.message)
      }
    } catch (error: any) {
      // Non-critical error - continue with env variable
      console.warn('[API] /api/call/connect - Could not fetch settings, using env fallback:', error.message || error)
    }

    if (!businessPhone) {
      console.error('[API] /api/call/connect - Business phone number not configured')
      twiml = new twilio.twiml.VoiceResponse()
      twiml.say('Sorry, there was an error connecting your call. The system is not properly configured.')
      twiml.hangup()
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
        },
      })
    }

    console.log('[API] /api/call/connect - Connecting call:', {
      customerPhone: `${customerPhone.substring(0, 4)}****`,
      businessPhone: `${businessPhone.substring(0, 4)}****`,
      callerId: businessPhone
    })

    // TwiML to connect the call
    // When courier answers, connect them to the customer
    twiml = new twilio.twiml.VoiceResponse()
    
    // Dial the customer's phone number with caller ID masking
    // Customer will see the business number, not the courier's real number
    const dial = twiml.dial({
      callerId: businessPhone, // Mask caller ID to show business number
      record: 'do-not-record', // Don't record calls by default
      timeout: 30, // Wait up to 30 seconds for answer
    })
    dial.number(customerPhone)

    const twimlString = twiml.toString()
    console.log('[API] /api/call/connect - TwiML generated successfully')
    console.log('[API] /api/call/connect - TwiML length:', twimlString.length, 'characters')
    console.log('[API] /api/call/connect - Connecting courier to customer')
    
    return new NextResponse(twimlString, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    })
  } catch (error: any) {
    console.error('[API] /api/call/connect - Unexpected error in connect webhook:', error)
    console.error('[API] /api/call/connect - Error stack:', error.stack)
    
    // Always return valid TwiML, even on unexpected errors
    try {
      twiml = new twilio.twiml.VoiceResponse()
      twiml.say('Sorry, there was an error connecting your call. Please try again later.')
      twiml.hangup()
      
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
        },
      })
    } catch (twimlError: any) {
      // Last resort - return minimal valid TwiML
      console.error('[API] /api/call/connect - Failed to generate error TwiML:', twimlError)
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, there was an error.</Say><Hangup/></Response>',
        {
          status: 200,
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
          },
        }
      )
    }
  }
}

/**
 * Handles the call connection webhook
 * When courier answers, connects them to the customer with caller ID masking
 */
export async function GET(request: NextRequest) {
  // Handle GET requests - Twilio might call with GET in some cases
  // Process the same way as POST
  console.log('[API] /api/call/connect - GET request received (processing as POST)')
  return handleConnectWebhook(request)
}

export async function POST(request: NextRequest) {
  // Note: This webhook is called by Twilio as part of our controlled call flow
  // Validation is handled in incoming/status webhooks which receive external requests
  return handleConnectWebhook(request)
}

