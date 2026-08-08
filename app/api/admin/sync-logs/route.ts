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
    // 1. Verify admin authorization
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
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

    // 3. Find logs that need syncing (status is attempted/ringing OR missing recording)
    const { data: logsToSync, error: fetchError } = await supabaseAdmin
      .from('call_logs')
      .select('id, twilio_call_sid, call_status, recording_url')
      .not('twilio_call_sid', 'is', null)
      .or('call_status.in.(attempted,ringing),recording_url.is.null')
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
        if (!log.recording_url && (call.status === 'completed' || call.status === 'in-progress')) {
          const recordings = await client.calls(log.twilio_call_sid).recordings.list({ limit: 5 })
          
          if (recordings && recordings.length > 0) {
            // Find completed recording
            const validRec = recordings.find(r => r.status === 'completed') || recordings[0]
            const recUri = `https://api.twilio.com${validRec.uri.replace('.json', '.mp3')}`
            
            updatePayload.recording_url = recUri
            updatePayload.recording_sid = validRec.sid
            updatePayload.recording_duration = validRec.duration ? parseInt(validRec.duration, 10) : null
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
