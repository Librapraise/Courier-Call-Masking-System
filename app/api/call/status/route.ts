import { NextRequest, NextResponse } from 'next/server'
import { validateTwilioWebhook } from '@/lib/twilio/webhook'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Handles Twilio call status callbacks
 * Updates call logs when call status changes (ringing, in-progress, completed, failed, etc.)
 */
export async function POST(request: NextRequest) {
  console.log('[API] /api/call/status - Status callback received from Twilio')
  try {
    // Get form data from Twilio status callback (must read once, then reuse)
    const formData = await request.formData()

    // In production, validate webhook signature using the formData we just read
    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction) {
      if (!(await validateTwilioWebhook(request, formData))) {
        console.error('[API] /api/call/status - Invalid Twilio webhook signature')
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const callDuration = formData.get('CallDuration') as string | null
    const from = formData.get('From') as string | null
    const to = formData.get('To') as string | null

    console.log('[API] /api/call/status - Call status update:', {
      callSid,
      callStatus,
      callDuration,
      from,
      to
    })

    if (!callSid) {
      console.error('[API] /api/call/status - Missing CallSid in request')
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

    console.log('[API] /api/call/status - Mapped status:', { twilioStatus: callStatus, internalStatus })

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
      console.log('[API] /api/call/status - Call completed with duration:', updateData.call_duration, 'seconds')
    }

    // Add error message if call failed
    if (callStatus === 'failed') {
      const errorMessage = formData.get('ErrorMessage') as string | null
      updateData.error_message = errorMessage || 'Call failed'
      console.error('[API] /api/call/status - Call failed:', updateData.error_message)
    }

    if (existingLog) {
      // Update existing log
      const updateResult = await supabaseAdmin
        .from('call_logs')
        .update(updateData)
        .eq('id', existingLog.id)

      if (updateResult.error) {
        console.error('[API] /api/call/status - Failed to update call log:', updateResult.error)
      } else {
        console.log('[API] /api/call/status - Call log updated successfully')
      }
    } else {
      // Create new log if it doesn't exist (shouldn't happen, but handle gracefully)
      console.warn('[API] /api/call/status - Call log not found for SID:', callSid, '- creating new entry')
      const insertResult = await supabaseAdmin.from('call_logs').insert({
        twilio_call_sid: callSid,
        call_status: internalStatus,
        call_timestamp: new Date().toISOString(),
        ...updateData,
      })

      if (insertResult.error) {
        console.error('[API] /api/call/status - Failed to create call log:', insertResult.error)
      } else {
        console.log('[API] /api/call/status - New call log created')
      }
    }

    console.log('[API] /api/call/status - Status callback processed successfully')
    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    console.error('[API] /api/call/status - Error handling call status callback:', error.message || error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

