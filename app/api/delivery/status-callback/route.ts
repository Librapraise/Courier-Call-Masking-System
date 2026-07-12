import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import twilio from 'twilio'
import { retryOperation } from '@/lib/twilio/webhook'

export async function POST(request: NextRequest) {
  console.log('[API] /api/delivery/status-callback - Status callback received')
  
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    
    if (!customerId) {
      console.error('[API] /api/delivery/status-callback - Missing customerId in query params')
      return new NextResponse('Missing customerId', { status: 400 })
    }

    // Read Twilio's webhook payload
    const formData = await request.formData()
    const messageSid = formData.get('MessageSid') as string
    const messageStatus = formData.get('MessageStatus') as string
    const errorCode = formData.get('ErrorCode') as string
    const errorMessage = formData.get('ErrorMessage') as string

    console.log(`[API] /api/delivery/status-callback - Message ${messageSid} status: ${messageStatus}` + 
                (errorCode ? `, Error Code: ${errorCode}, Error Message: ${errorMessage}` : ''))

    // If the WhatsApp message failed or was undelivered, trigger the fallback SMS
    if (messageStatus === 'failed' || messageStatus === 'undelivered') {
      console.log(`[API] /api/delivery/status-callback - WhatsApp failed. Triggering SMS fallback for customer ${customerId}...`)

      // Fetch customer
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('phone_number, feedback_slug')
        .eq('id', customerId)
        .single()

      if (customerError || !customer) {
        console.error('[API] /api/delivery/status-callback - Customer not found for fallback SMS:', customerError?.message)
        return new NextResponse('Customer not found', { status: 404 })
      }

      // Build SMS
      const smsBody = `היי!😊מקווים שנהנית מההזמנה 📦🎉
איך היית מדרג/ת אותנו מ-1 עד 5? ⭐
נשמח לשמוע איך היו זמני המשלוח, השירות של השליח ואיכות המוצר.
זה לוקח פחות מדקה והמשוב שלך עוזר לנו להשתפר. ❤️👇`

      let baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        const protocol = request.nextUrl.protocol || 'http:'
        const host = request.headers.get('host') || request.nextUrl.host
        baseUrl = `${protocol}//${host}`
      }
      baseUrl = baseUrl.replace(/\/$/, '')
      const feedbackUrl = `${baseUrl}/f/${customer.feedback_slug}`

      const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
      const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER?.split('#')[0].trim()

      if (!accountSid || !authToken || !twilioPhoneNumber) {
        console.error('[API] /api/delivery/status-callback - Twilio configuration missing for fallback SMS')
        return new NextResponse('Twilio config missing', { status: 500 })
      }

      const client = twilio(accountSid, authToken)

      try {
        await retryOperation(
          () => client.messages.create({
            to: customer.phone_number,
            from: twilioPhoneNumber,
            body: `${smsBody}\n\nקישור למשוב: ${feedbackUrl}`,
          }),
          3,
          1000
        )
        console.log('[API] /api/delivery/status-callback - Fallback SMS sent successfully to', customer.phone_number.substring(0, 7) + '****')
      } catch (smsErr: any) {
        console.error('[API] /api/delivery/status-callback - Fallback SMS sending failed:', smsErr.message || smsErr)
      }
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    console.error('[API] /api/delivery/status-callback - Error:', error.message || error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
