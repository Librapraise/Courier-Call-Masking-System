import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Auth: check bearer token first, then cookies
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

  if (!user) {
    console.error('[Stream] Unauthorized – no user found')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    console.error('[Stream] Forbidden – user is not admin:', user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: log, error: dbError } = await supabaseAdmin
    .from('call_logs')
    .select('recording_url')
    .eq('id', id)
    .single()

  if (dbError || !log?.recording_url) {
    console.error('[Stream] Recording not found for log id:', id, 'dbError:', dbError?.message)
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  console.log('[Stream] Fetching recording URL:', log.recording_url)

  const range = request.headers.get('range')
  const upstreamHeaders: Record<string, string> = {}
  if (range) upstreamHeaders.Range = range

  const credentials = `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  const upstream = await fetch(log.recording_url, {
    headers: {
      ...upstreamHeaders,
      Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
    },
  })

  console.log('[Stream] Twilio response status:', upstream.status, 'Content-Type:', upstream.headers.get('content-type'))

  if (!upstream.ok && upstream.status !== 206) {
    const body = await upstream.text()
    console.error('[Stream] Twilio returned error:', upstream.status, body)
    return new NextResponse(`Unable to fetch recording: ${upstream.status}`, { status: upstream.status })
  }

  const responseHeaders = new Headers()
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }
  // Ensure content-type is set for audio (Twilio sometimes omits it)
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'audio/mpeg')
  }
  responseHeaders.set('Cache-Control', 'private, max-age=3600')
  responseHeaders.set('Accept-Ranges', 'bytes')

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders })
}
