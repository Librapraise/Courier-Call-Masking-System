import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { validateTwilioWebhook } from '@/lib/twilio/webhook'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`[API] /api/whatsapp/incoming [${timestamp}] - Inbound WhatsApp webhook called`)

  try {
    const formData = await request.formData()

    // Validate Twilio signature in production if signature header is present
    if (process.env.NODE_ENV === 'production' && request.headers.get('X-Twilio-Signature')) {
      const isValid = await validateTwilioWebhook(request, formData)
      if (!isValid) {
        console.error(`[API] /api/whatsapp/incoming [${timestamp}] - Invalid Twilio signature`)
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    const fromRaw = formData.get('From')?.toString() || ''
    const body = formData.get('Body')?.toString() || ''
    const messageSid = formData.get('MessageSid')?.toString() || ''
    const profileName = formData.get('ProfileName')?.toString() || null

    console.log(`[API] /api/whatsapp/incoming [${timestamp}] - Received payload:`, {
      fromRaw,
      bodyLength: body.length,
      messageSid,
      profileName
    })

    if (!fromRaw || !body) {
      console.error(`[API] /api/whatsapp/incoming [${timestamp}] - Missing required fields (From or Body)`)
      const twiml = new twilio.twiml.VoiceResponse()
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' }
      })
    }

    // Sanitize phone number (remove "whatsapp:" prefix if present)
    const phoneNumber = fromRaw.replace('whatsapp:', '').trim()

    // Match phone number with active or past customer
    // Try exact match or match by trailing digits
    let customerId: string | null = null

    const { data: customerMatch } = await supabaseAdmin
      .from('customers')
      .select('id, name')
      .eq('phone_number', phoneNumber)
      .maybeSingle()

    if (customerMatch) {
      customerId = customerMatch.id
      console.log(`[API] /api/whatsapp/incoming - Matched customer: ${customerMatch.name} (${customerId})`)
    } else {
      // Fallback matching by last 9 digits if country code formatting varies
      const lastDigits = phoneNumber.slice(-9)
      if (lastDigits.length >= 7) {
        const { data: fuzzyMatch } = await supabaseAdmin
          .from('customers')
          .select('id, name')
          .ilike('phone_number', `%${lastDigits}`)
          .maybeSingle()

        if (fuzzyMatch) {
          customerId = fuzzyMatch.id
          console.log(`[API] /api/whatsapp/incoming - Fuzzy matched customer: ${fuzzyMatch.name} (${customerId})`)
        }
      }
    }

    // Save WhatsApp reply to database
    const { data: replyRecord, error: insertError } = await supabaseAdmin
      .from('whatsapp_replies')
      .insert({
        customer_id: customerId,
        phone_number: phoneNumber,
        profile_name: profileName,
        message_body: body.trim(),
        message_sid: messageSid || null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error(`[API] /api/whatsapp/incoming [${timestamp}] - Failed to save WhatsApp reply:`, insertError.message)
    } else {
      console.log(`[API] /api/whatsapp/incoming [${timestamp}] - WhatsApp reply saved successfully with ID ${replyRecord.id}`)
    }

    // Return empty TwiML response to Twilio
    const twimlResponse = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    return new NextResponse(twimlResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' }
    })

  } catch (error: any) {
    console.error(`[API] /api/whatsapp/incoming [${timestamp}] - Error processing webhook:`, error.message || error)
    
    // Always return 200 OK with empty TwiML so Twilio doesn't retry endlessly on app error
    const fallbackTwiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    return new NextResponse(fallbackTwiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' }
    })
  }
}
