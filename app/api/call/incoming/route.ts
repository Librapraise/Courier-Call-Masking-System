import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { validateTwilioWebhook, maskPhoneNumber } from '@/lib/twilio/webhook'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Handles incoming calls to the Twilio number
 * Plays a message to inform callers this is an outbound-only number
 */
export async function POST(request: NextRequest) {
  try {
    // Get form data from Twilio (must read once, then reuse)
    const formData = await request.formData()

    // In production, validate webhook signature using the formData we just read
    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction) {
      if (!(await validateTwilioWebhook(request, formData))) {
        console.error('Invalid Twilio webhook signature')
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const callSid = formData.get('CallSid') as string

    // Get incoming call message from settings
    const { data: setting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'incoming_call_message')
      .single()

    const message = setting?.value || 
      'This number is for outbound calls only. Please wait for our agent to call you.'

    // Log the incoming call attempt
    await supabaseAdmin.from('call_logs').insert({
      twilio_call_sid: callSid,
      call_status: 'incoming_blocked',
      customer_phone_masked: maskPhoneNumber(from),
      call_timestamp: new Date().toISOString(),
      error_message: 'Incoming call - message played',
    })

    // Create TwiML response to play message
    const twiml = new twilio.twiml.VoiceResponse()
    twiml.say(
      {
        voice: 'alice',
        language: 'en-US',
      },
      message
    )
    twiml.hangup()

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('Error handling incoming call:', error)
    
    // Fallback: return a simple message
    const twiml = new twilio.twiml.VoiceResponse()
    twiml.say(
      {
        voice: 'alice',
        language: 'en-US',
      },
      'This number is for outbound calls only. Please wait for our agent to call you.'
    )
    twiml.hangup()

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}

