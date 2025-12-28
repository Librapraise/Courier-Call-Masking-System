import { NextRequest, NextResponse } from 'next/server'
import { validateTwilioWebhook } from '@/lib/twilio/webhook'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Handles Twilio call status callbacks
 * Updates call logs when call status changes (ringing, in-progress, completed, failed, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Get form data from Twilio status callback (must read once, then reuse)
    const formData = await request.formData()

    // In production, validate webhook signature using the formData we just read
    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction) {
      if (!(await validateTwilioWebhook(request, formData))) {
        console.error('Invalid Twilio webhook signature')
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const callDuration = formData.get('CallDuration') as string | null
    const from = formData.get('From') as string | null
    const to = formData.get('To') as string | null

    if (!callSid) {
      return new NextResponse('Missing CallSid', { status: 400 })
    }

    // Map Twilio call status to our internal status
    const statusMap: Record<string, string> = {
      'queued': 'attempted',
      'ringing': 'ringing',
      'in-progress': 'connected',
      'completed': 'completed',
      'busy': 'busy',
      'no-answer': 'no-answer',
      'failed': 'failed',
      'canceled': 'failed',
    }

    const internalStatus = statusMap[callStatus] || callStatus

    // Find existing call log by Twilio SID
    const { data: existingLog } = await supabaseAdmin
      .from('call_logs')
      .select('id')
      .eq('twilio_call_sid', callSid)
      .single()

    const updateData: any = {
      call_status: internalStatus,
      updated_at: new Date().toISOString(),
    }

    // Add duration if call was completed
    if (callDuration && callStatus === 'completed') {
      updateData.call_duration = parseInt(callDuration, 10)
    }

    // Add error message if call failed
    if (callStatus === 'failed') {
      const errorMessage = formData.get('ErrorMessage') as string | null
      updateData.error_message = errorMessage || 'Call failed'
    }

    if (existingLog) {
      // Update existing log
      await supabaseAdmin
        .from('call_logs')
        .update(updateData)
        .eq('id', existingLog.id)
    } else {
      // Create new log if it doesn't exist (shouldn't happen, but handle gracefully)
      console.warn(`Call log not found for SID: ${callSid}, creating new entry`)
      await supabaseAdmin.from('call_logs').insert({
        twilio_call_sid: callSid,
        call_status: internalStatus,
        call_timestamp: new Date().toISOString(),
        ...updateData,
      })
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    console.error('Error handling call status callback:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

