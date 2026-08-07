import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { validateTwilioWebhook } from '@/lib/twilio/webhook'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Handles Twilio recording status callback webhooks
 * Updates call_logs table with recording URL, SID, and duration when recording completes
 */
export async function GET(request: NextRequest) {
  return new NextResponse('This endpoint accepts POST requests from Twilio only.', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Allow': 'POST, DELETE',
    },
  })
}

export async function POST(request: NextRequest) {
  console.log('[API] /api/call/recording - Recording callback received from Twilio')
  try {
    const formData = await request.formData()

    // Validate webhook signature in production
    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction) {
      if (!(await validateTwilioWebhook(request, formData))) {
        console.error('[API] /api/call/recording - Invalid Twilio webhook signature')
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    const callSid = formData.get('CallSid') as string
    const recordingUrl = formData.get('RecordingUrl') as string
    const recordingSid = formData.get('RecordingSid') as string
    const recordingDuration = formData.get('RecordingDuration') as string | null
    const recordingStatus = formData.get('RecordingStatus') as string

    console.log('[API] /api/call/recording - Callback payload:', {
      callSid,
      recordingSid,
      recordingStatus,
      recordingDuration,
      hasRecordingUrl: !!recordingUrl,
    })

    if (!callSid || !recordingUrl) {
      console.error('[API] /api/call/recording - Missing CallSid or RecordingUrl')
      return new NextResponse('Missing required fields', { status: 400 })
    }

    // Standardize URL to MP3 for direct HTML5 browser playback
    const mp3RecordingUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`
    const durationSec = recordingDuration ? parseInt(recordingDuration, 10) : null

    // Try finding call log by exact callSid first
    const { data: existingLog, error: searchError } = await supabaseAdmin
      .from('call_logs')
      .select('id, twilio_call_sid')
      .eq('twilio_call_sid', callSid)
      .maybeSingle()

    if (searchError) {
      console.error('[API] /api/call/recording - Error searching for call log:', searchError)
    }

    let targetLogId = existingLog?.id

    // Fallback: If CallSid was for child leg, find most recent call log without a recording in past 1 hour
    if (!targetLogId) {
      console.warn(`[API] /api/call/recording - Call log not found for exact SID ${callSid}, trying recent unmatched log fallback`)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: recentLog } = await supabaseAdmin
        .from('call_logs')
        .select('id')
        .is('recording_url', null)
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentLog) {
        targetLogId = recentLog.id
      }
    }

    if (targetLogId) {
      const { error: updateError } = await supabaseAdmin
        .from('call_logs')
        .update({
          recording_url: mp3RecordingUrl,
          recording_sid: recordingSid,
          recording_duration: durationSec,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetLogId)

      if (updateError) {
        console.error('[API] /api/call/recording - Failed to update call log recording:', updateError)
        return new NextResponse('Failed to update log', { status: 500 })
      }

      console.log(`[API] /api/call/recording - Successfully saved recording for call log ${targetLogId}`)
    } else {
      console.warn('[API] /api/call/recording - No call log found to attach recording:', { callSid, recordingSid })
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    console.error('[API] /api/call/recording - Unexpected error handling recording webhook:', error.message || error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

/**
 * Deletes a call recording permanently from Twilio's servers and clears the DB reference.
 * Expects JSON body: { callLogId: string, recordingSid: string, accessToken?: string }
 * Requires admin authentication.
 */
export async function DELETE(request: NextRequest) {
  console.log('[API] /api/call/recording - Delete recording request received')
  try {
    const body = await request.json()
    const { callLogId, recordingSid, accessToken } = body

    if (!callLogId || !recordingSid) {
      return NextResponse.json(
        { error: 'Missing required fields: callLogId and recordingSid' },
        { status: 400 }
      )
    }

    // Authenticate the requesting user
    let user = null
    let authError = null

    if (accessToken) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
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
            getAll() { return request.cookies.getAll() },
            setAll() {},
          },
        }
      )
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
    }

    if (authError || !user) {
      console.error('[API] /api/call/recording DELETE - Unauthorized:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      console.error('[API] /api/call/recording DELETE - Forbidden, role:', profile?.role)
      return NextResponse.json({ error: 'Only admins can delete recordings' }, { status: 403 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      console.error('[API] /api/call/recording DELETE - Twilio credentials missing')
      return NextResponse.json({ error: 'Twilio configuration missing' }, { status: 500 })
    }

    // Delete the recording from Twilio's servers
    let twilioDeleteError: string | null = null
    try {
      const client = twilio(accountSid, authToken)
      await client.recordings(recordingSid).remove()
      console.log(`[API] /api/call/recording DELETE - Deleted recording ${recordingSid} from Twilio`)
    } catch (err: any) {
      // Recording may have already been deleted or SID is invalid — log but don't block DB cleanup
      twilioDeleteError = err.message || 'Unknown Twilio error'
      console.warn(`[API] /api/call/recording DELETE - Twilio delete failed (continuing with DB cleanup):`, twilioDeleteError)
    }

    // Clear recording fields from the call log in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('call_logs')
      .update({
        recording_url: null,
        recording_sid: null,
        recording_duration: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', callLogId)

    if (updateError) {
      console.error('[API] /api/call/recording DELETE - Failed to clear recording from DB:', updateError)
      return NextResponse.json({ error: 'Failed to remove recording from database' }, { status: 500 })
    }

    console.log(`[API] /api/call/recording DELETE - Recording cleared from call log ${callLogId}`)

    return NextResponse.json({
      success: true,
      message: 'Recording deleted successfully',
      ...(twilioDeleteError && { twilioWarning: twilioDeleteError }),
    })
  } catch (error: any) {
    console.error('[API] /api/call/recording DELETE - Unexpected error:', error.message || error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
