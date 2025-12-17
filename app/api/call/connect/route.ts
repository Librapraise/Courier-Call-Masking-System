import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const customerPhone = searchParams.get('customerPhone')

  if (!customerPhone) {
    return NextResponse.json({ error: 'Customer phone number required' }, { status: 400 })
  }

  // TwiML to connect the call
  // When courier answers, connect them to the customer
  const twiml = new twilio.twiml.VoiceResponse()
  
  // Dial the customer's phone number
  const dial = twiml.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,
  })
  dial.number(customerPhone)

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
  })
}

