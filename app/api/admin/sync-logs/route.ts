import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Syncs stuck call logs ('attempted', 'ringing') or missing recordings with Twilio REST API
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authorization using Bearer token or request cookies
    let user = null
    const authHeader = request.headers.get('Authorization')

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data } = await supabaseAdmin.auth.getUser(token)
      user = data.user
    }

    if (!user) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll() {},
          },
        }
      )
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Initialize Twilio client
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
    }

    const client = twilio(accountSid, authToken)

    // 3. Find logs that need syncing:
    //    a) still stuck on attempted/ringing
    //    b) completed but missing a recording URL (common with <Dial> two-leg calls)
    const { data: logsToSync, error: fetchError } = await supabaseAdmin
      .from('call_logs')
      .select('id, twilio_call_sid, call_status, recording_url')
      .not('twilio_call_sid', 'is', null)
      .or('call_status.in.(attempted,ringing),and(call_status.eq.completed,recording_url.is.null)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (fetchError) {
      console.error('[API] /api/admin/sync-logs - Error fetching logs:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!logsToSync || logsToSync.length === 0) {
      return NextResponse.json({ message: 'No logs require syncing', syncedCount: 0 })
    }

    console.log(`[API] /api/admin/sync-logs - Found ${logsToSync.length} logs to check with Twilio`)

    let updatedCount = 0

    // Map Twilio call statuses to app status
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

    for (const log of logsToSync) {
      if (!log.twilio_call_sid) continue

      try {
        // Fetch call resource from Twilio
        const call = await client.calls(log.twilio_call_sid).fetch()
        const mappedStatus = statusMap[call.status] || call.status

        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString()
        }

        if (log.call_status !== mappedStatus) {
          updatePayload.call_status = mappedStatus
        }

        if (call.duration) {
          updatePayload.call_duration = parseInt(call.duration, 10)
        }

        // Check for recordings if missing
        // For <Dial record="record-from-answer-dual"> calls, the recording is on the
        // CHILD call leg, not the parent SID. So we search both by callSid and parentCallSid.
        if (!log.recording_url && (call.status === 'completed' || call.status === 'in-progress')) {
          let recordings: any[] = await client.calls(log.twilio_call_sid).recordings.list({ limit: 5 })

          // If none found on parent call, try searching account recordings by parentCallSid
          if (!recordings || recordings.length === 0) {
            recordings = await client.recordings.list({
              callSid: log.twilio_call_sid,
              limit: 5,
            } as any)
          }

          if (recordings && recordings.length > 0) {
            const validRec = recordings.find((r: any) => r.status === 'completed') || recordings[0]
            const rawUri = validRec.uri.endsWith('.json') ? validRec.uri.slice(0, -5) : validRec.uri
            const recUri = `https://api.twilio.com${rawUri}.mp3`

            updatePayload.recording_url = recUri
            updatePayload.recording_sid = validRec.sid
            updatePayload.recording_duration = validRec.duration ? parseInt(validRec.duration, 10) : null

            console.log(`[API] /api/admin/sync-logs - Found recording for ${log.twilio_call_sid}:`, recUri)
          } else {
            console.log(`[API] /api/admin/sync-logs - No recordings found for call SID:`, log.twilio_call_sid)
          }
        }

        // If changes were found, update DB
        if (Object.keys(updatePayload).length > 1) { // more than just updated_at
          const { error: updateErr } = await supabaseAdmin
            .from('call_logs')
            .update(updatePayload)
            .eq('id', log.id)

          if (!updateErr) {
            updatedCount++
          } else {
            console.error(`[API] /api/admin/sync-logs - Failed to update log ${log.id}:`, updateErr)
          }
        }
      } catch (twilioErr: any) {
        console.warn(`[API] /api/admin/sync-logs - Could not fetch SID ${log.twilio_call_sid} from Twilio:`, twilioErr.message || twilioErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${logsToSync.length} logs, updated ${updatedCount} logs from Twilio.`,
      syncedCount: updatedCount,
    })
  } catch (err: any) {
    console.error('[API] /api/admin/sync-logs - Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
