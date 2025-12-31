import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { retryOperation, maskPhoneNumber } from '@/lib/twilio/webhook'

export async function POST(request: NextRequest) {
  console.log('[API] /api/call/initiate - Call initiation request received')
  try {
    // Validate Twilio environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.error('[API] /api/call/initiate - Twilio configuration missing')
      return NextResponse.json(
        { error: 'Twilio configuration is missing. Please check environment variables.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { customerId, accessToken } = body

    console.log('[API] /api/call/initiate - Request body:', { customerId, hasAccessToken: !!accessToken })

    if (!customerId) {
      console.error('[API] /api/call/initiate - Missing customerId parameter')
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
      console.error('[API] /api/call/initiate - Auth error:', authError?.message || 'No user found', 'Has token:', !!accessToken)
      return NextResponse.json(
        { error: 'Unauthorized - Please log in', details: authError?.message || 'Session not found' },
        { status: 401 }
      )
    }

    console.log('[API] /api/call/initiate - User authenticated:', { userId: user.id, email: user.email })


    // Verify courier is authenticated and get their profile
    const { data: courierProfile, error: courierError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, email, phone_number')
      .eq('id', user.id)
      .single()

    if (courierError || !courierProfile) {
      console.error('[API] /api/call/initiate - Profile not found:', courierError?.message)
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 401 }
      )
    }

    console.log('[API] /api/call/initiate - Courier profile retrieved:', { role: courierProfile.role, email: courierProfile.email })

    if (courierProfile.role !== 'courier') {
      console.error('[API] /api/call/initiate - Unauthorized role:', courierProfile.role)
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
      console.error('[API] /api/call/initiate - Customer not found:', customerError?.message)
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    console.log('[API] /api/call/initiate - Customer retrieved:', { customerId: customer.id, name: customer.name, isActive: customer.is_active })

    if (!customer.is_active) {
      console.error('[API] /api/call/initiate - Customer is inactive')
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
      console.error('[API] /api/call/initiate - Invalid webhook URL (localhost):', connectWebhookUrl)
      return NextResponse.json(
        { 
          error: 'Twilio webhook URL must be publicly accessible. For local development, use ngrok or deploy to a public URL.',
          details: 'Current URL: ' + connectWebhookUrl
        },
        { status: 400 }
      )
    }

    console.log('[API] /api/call/initiate - Webhook URLs configured:', { connectWebhookUrl, statusCallbackUrl })

    // Initialize Twilio client
    const client = twilio(accountSid, authToken)

    // Get agent name (courier email or profile name)
    const agentName = courierProfile.email || `Courier ${courierProfile.id.slice(0, 8)}`

    console.log('[API] /api/call/initiate - Initiating Twilio call:', {
      to: courierPhoneNumber,
      from: twilioPhoneNumber,
      customerName: customer.name,
      agentName
    })

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

      console.log('[API] /api/call/initiate - Twilio call created successfully:', { callSid: call.sid, status: call.status })

      // Log comprehensive call information
      const logResult = await supabaseAdmin.from('call_logs').insert({
        customer_id: customerId,
        customer_name: customer.name,
        customer_phone_masked: maskPhoneNumber(customer.phone_number),
        courier_id: user.id,
        agent_name: agentName,
        call_status: 'attempted',
        call_timestamp: new Date().toISOString(),
        twilio_call_sid: call.sid,
      })

      if (logResult.error) {
        console.error('[API] /api/call/initiate - Failed to log call:', logResult.error)
      } else {
        console.log('[API] /api/call/initiate - Call logged to database successfully')
      }

      console.log('[API] /api/call/initiate - Call initiation completed successfully')
      return NextResponse.json({
        success: true,
        callSid: call.sid,
        message: 'Call initiated successfully',
      })
    } catch (twilioError: any) {
      console.error('[API] /api/call/initiate - Twilio error:', twilioError.message || twilioError)

      // Log failed call attempt with error details
      const logResult = await supabaseAdmin.from('call_logs').insert({
        customer_id: customerId,
        customer_name: customer.name,
        customer_phone_masked: maskPhoneNumber(customer.phone_number),
        courier_id: user.id,
        agent_name: agentName,
        call_status: 'failed',
        call_timestamp: new Date().toISOString(),
        error_message: twilioError.message || 'Failed to initiate call',
      })

      if (logResult.error) {
        console.error('[API] /api/call/initiate - Failed to log failed call:', logResult.error)
      }

      return NextResponse.json(
        { error: `Failed to initiate call: ${twilioError.message || 'Unknown error'}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[API] /api/call/initiate - Unexpected error:', error.message || error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

