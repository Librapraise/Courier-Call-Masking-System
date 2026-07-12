import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { retryOperation } from '@/lib/twilio/webhook'
import { generateUniqueFeedbackSlug } from '@/lib/utils/slug'

export async function POST(request: NextRequest) {
  console.log('[API] /api/delivery/complete - Delivery completion request received')
  try {
    const body = await request.json()
    const { customerId, accessToken } = body

    if (!customerId) {
      return NextResponse.json(
        { error: 'Missing required parameter: customerId' },
        { status: 400 }
      )
    }

    // Verify user session using access token or cookies
    let user = null
    let authError = null

    if (accessToken) {
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
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll() { },
          },
        }
      )
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
    }

    if (authError || !user) {
      console.error('[API] /api/delivery/complete - Auth error:', authError?.message || 'No user found')
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Get courier profile and verify role
    const { data: courierProfile, error: courierError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (courierError || !courierProfile) {
      console.error('[API] /api/delivery/complete - Profile not found:', courierError?.message)
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 401 }
      )
    }

    if (courierProfile.role !== 'courier') {
      console.error('[API] /api/delivery/complete - Unauthorized role:', courierProfile.role)
      return NextResponse.json(
        { error: 'Only couriers can complete deliveries' },
        { status: 403 }
      )
    }

    // Fetch customer details (phone number, name)
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, name, phone_number, is_active, is_completed')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.error('[API] /api/delivery/complete - Customer not found:', customerError?.message)
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

    // Generate a short unique feedback slug
    const feedbackSlug = await generateUniqueFeedbackSlug()

    // Update customer completed status and set feedback slug
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({
        is_completed: true,
        feedback_slug: feedbackSlug
      })
      .eq('id', customerId)

    if (updateError) {
      console.error('[API] /api/delivery/complete - Failed to update customer:', updateError.message)
      return NextResponse.json(
        { error: 'Failed to update delivery status' },
        { status: 500 }
      )
    }

    console.log(`[API] /api/delivery/complete - Marked customer ${customerId} as completed with slug ${feedbackSlug}`)

    // Send SMS and WhatsApp via Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER?.split('#')[0].trim()
    const twilioWhatsAppNumber = (process.env.TWILIO_WHATSAPP_NUMBER?.split('#')[0].trim()) || twilioPhoneNumber

    let smsSent = false
    let smsError = null
    let whatsAppSent = false
    let whatsAppError = null

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.error('[API] /api/delivery/complete - Twilio config missing, skipping SMS and WhatsApp')
      smsError = 'Twilio credentials not configured'
      whatsAppError = 'Twilio credentials not configured'
    } else {
      // Build feedback landing page URL (using a short path '/f/')
      let baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        const protocol = request.nextUrl.protocol || 'http:'
        const host = request.headers.get('host') || request.nextUrl.host
        baseUrl = `${protocol}//${host}`
      }
      baseUrl = baseUrl.replace(/\/$/, '')
      const feedbackUrl = `${baseUrl}/f/${feedbackSlug}`

      const client = twilio(accountSid, authToken)
      const smsBody = `היי!😊מקווים שנהנית מההזמנה 📦🎉
איך היית מדרג/ת אותנו מ-1 עד 5? ⭐
נשמח לשמוע איך היו זמני המשלוח, השירות של השליח ואיכות המוצר.
זה לוקח פחות מדקה והמשוב שלך עוזר לנו להשתפר. ❤️👇`

      const statusCallbackUrl = `${baseUrl}/api/delivery/status-callback?customerId=${customerId}`

      // 1. Send WhatsApp first
      try {
        console.log(`[API] /api/delivery/complete - Sending WhatsApp via Twilio to ${customer.phone_number.substring(0, 7)}****`)
        const whatsAppTemplateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID

        let message: any;
        if (whatsAppTemplateSid) {

          console.log('[API] /api/delivery/complete - Sending WhatsApp (0-variable template)')

          message = await retryOperation(
            () => client.messages.create({
              to: `whatsapp:${customer.phone_number}`,
              from: `whatsapp:${twilioWhatsAppNumber}`,
              contentSid: whatsAppTemplateSid,
              statusCallback: statusCallbackUrl
            }),
            3, // retries
            1000 // initial delay
          )
        } else {
          // Fallback to freeform body if no template is configured (requires active session)
          message = await retryOperation(
            () => client.messages.create({
              to: `whatsapp:${customer.phone_number}`,
              from: `whatsapp:${twilioWhatsAppNumber}`,
              body: smsBody,
              statusCallback: statusCallbackUrl
            }),
            3, // retries
            1000 // initial delay
          )
        }
        console.log(`[API] /api/delivery/complete - WhatsApp message queued. SID: ${message.sid}, Status: ${message.status}`)
        whatsAppSent = true
      } catch (err: any) {
        console.error('[API] /api/delivery/complete - Twilio WhatsApp sending failed, falling back to SMS:', err.message || err)
        whatsAppError = err.message || String(err)

        // Fallback: Send SMS
        try {
          console.log(`[API] /api/delivery/complete - Sending fallback SMS via Twilio to ${customer.phone_number.substring(0, 7)}****`)
          await retryOperation(
            () => client.messages.create({
              to: customer.phone_number,
              from: twilioPhoneNumber,
              body: `${smsBody}\n\nקישור למשוב: ${feedbackUrl}`,
            }),
            3, // retries
            1000 // initial delay
          )
          console.log('[API] /api/delivery/complete - Fallback SMS sent successfully')
          smsSent = true
        } catch (smsErr: any) {
          console.error('[API] /api/delivery/complete - Twilio fallback SMS sending failed:', smsErr.message || smsErr)
          smsError = smsErr.message || String(smsErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      smsSent,
      smsError,
      whatsAppSent,
      whatsAppError,
    })
  } catch (error: any) {
    console.error('[API] /api/delivery/complete - Unexpected error:', error.message || error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
