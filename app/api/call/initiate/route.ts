import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { retryOperation, maskPhoneNumber } from '@/lib/twilio/webhook'

export async function POST(request: NextRequest) {
  try {
    // Validate Twilio environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      return NextResponse.json(
        { error: 'Twilio configuration is missing. Please check environment variables.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { customerId, accessToken } = body

    if (!customerId) {
      return NextResponse.json(
        { error: 'Missing required parameter: customerId' },
        { status: 400 }
      )
    }

    // Verify user session using access token
    let user = null
    let authError = null

    if (accessToken) {
      // Create a client with the access token in headers
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      )
      const result = await supabaseWithToken.auth.getUser()
      user = result.data.user
      authError = result.error
    } else {
      // Fallback: try cookies
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll() {
              // No-op for API routes
            },
          },
        }
      )
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
    }
    
    if (authError || !user) {
      console.error('Auth error:', authError?.message || 'No user found', 'Has token:', !!accessToken)
      return NextResponse.json(
        { error: 'Unauthorized - Please log in', details: authError?.message || 'Session not found' },
        { status: 401 }
      )
    }


    // Verify courier is authenticated and get their profile
    const { data: courierProfile, error: courierError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, email, phone_number')
      .eq('id', user.id)
      .single()

    if (courierError || !courierProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 401 }
      )
    }

    if (courierProfile.role !== 'courier') {
      return NextResponse.json(
        { error: 'Only couriers can initiate calls' },
        { status: 403 }
      )
    }

    // Get courier's phone number from profile
    const courierPhoneNumber = courierProfile.phone_number || process.env.COURIER_PHONE_NUMBER
    
    if (!courierPhoneNumber) {
      return NextResponse.json(
        { error: 'Courier phone number not configured' },
        { status: 400 }
      )
    }

    // Fetch customer phone number (server-side only - never sent to frontend)
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, name, phone_number, is_active')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    if (!customer.is_active) {
      return NextResponse.json(
        { error: 'Customer is inactive' },
        { status: 400 }
      )
    }

    // Validate webhook URL (Twilio requires publicly accessible URL)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const connectWebhookUrl = `${appUrl}/api/call/connect?customerPhone=${encodeURIComponent(customer.phone_number)}&customerId=${customerId}&courierId=${user.id}`
    const statusCallbackUrl = `${appUrl}/api/call/status`
    
    // Check if using localhost (Twilio can't reach localhost)
    if (connectWebhookUrl.includes('localhost') || connectWebhookUrl.includes('127.0.0.1')) {
      return NextResponse.json(
        { 
          error: 'Twilio webhook URL must be publicly accessible. For local development, use ngrok or deploy to a public URL.',
          details: 'Current URL: ' + connectWebhookUrl
        },
        { status: 400 }
      )
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken)

    // Get agent name (courier email or profile name)
    const agentName = courierProfile.email || `Courier ${courierProfile.id.slice(0, 8)}`

    // Initiate Twilio call with retry logic
    // Call flow: Courier's phone → Twilio number → Customer's phone
    // We call the courier first, then connect them to the customer
    try {
      const call = await retryOperation(
        () => client.calls.create({
          to: courierPhoneNumber,
          from: twilioPhoneNumber,
          url: connectWebhookUrl,
          method: 'POST',
          statusCallback: statusCallbackUrl,
          statusCallbackMethod: 'POST',
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'no-answer', 'failed', 'canceled'],
        }),
        3, // max retries
        1000 // initial delay
      )

      // Log comprehensive call information
      await supabaseAdmin.from('call_logs').insert({
        customer_id: customerId,
        customer_name: customer.name,
        customer_phone_masked: maskPhoneNumber(customer.phone_number),
        courier_id: user.id,
        agent_name: agentName,
        call_status: 'attempted',
        call_timestamp: new Date().toISOString(),
        twilio_call_sid: call.sid,
      })

      return NextResponse.json({
        success: true,
        callSid: call.sid,
        message: 'Call initiated successfully',
      })
    } catch (twilioError: any) {
      console.error('Twilio error:', twilioError)

      // Log failed call attempt with error details
      await supabaseAdmin.from('call_logs').insert({
        customer_id: customerId,
        customer_name: customer.name,
        customer_phone_masked: maskPhoneNumber(customer.phone_number),
        courier_id: user.id,
        agent_name: agentName,
        call_status: 'failed',
        call_timestamp: new Date().toISOString(),
        error_message: twilioError.message || 'Failed to initiate call',
      })

      return NextResponse.json(
        { error: `Failed to initiate call: ${twilioError.message || 'Unknown error'}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

