import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Debug endpoint: returns info about a call log's recording URL and Twilio response
 * GET /api/admin/debug-recording?id=<log_id>
 */
export async function GET(request: NextRequest) {
  // Auth check
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
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } },
    )
    const { data } = await supabase.auth.getUser()
    user = data.user
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id param' }, { status: 400 })

  // Fetch from DB
  const { data: log, error: dbError } = await supabaseAdmin
    .from('call_logs')
    .select('id, recording_url, recording_sid, twilio_call_sid, call_status')
    .eq('id', id)
    .single()

  if (dbError || !log) {
    return NextResponse.json({ error: 'Log not found', dbError: dbError?.message }, { status: 404 })
  }

  if (!log.recording_url) {
    return NextResponse.json({ log, twilioCheck: 'No recording_url stored', status: 'no_recording' })
  }

  // Try fetching from Twilio
  const credentials = `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  let twilioStatus: number | null = null
  let twilioContentType: string | null = null
  let twilioContentLength: string | null = null
  let twilioError: string | null = null

  try {
    const res = await fetch(log.recording_url, {
      method: 'HEAD',
      headers: {
        Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
      },
    })
    twilioStatus = res.status
    twilioContentType = res.headers.get('content-type')
    twilioContentLength = res.headers.get('content-length')
    if (!res.ok) {
      twilioError = await res.text()
    }
  } catch (e: any) {
    twilioError = e.message
  }

  return NextResponse.json({
    log,
    twilio: {
      status: twilioStatus,
      contentType: twilioContentType,
      contentLength: twilioContentLength,
      error: twilioError,
    }
  })
}
