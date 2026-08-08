import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: log, error } = await supabaseAdmin.from('call_logs').select('recording_url').eq('id', id).single()
  if (error || !log?.recording_url) return NextResponse.json({ error: 'Recording not found' }, { status: 404 })

  const range = request.headers.get('range')
  const headers: Record<string, string> = {}
  if (range) headers.Range = range
  const credentials = `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  const upstream = await fetch(log.recording_url, {
    headers: { ...headers, Authorization: `Basic ${Buffer.from(credentials).toString('base64')}` },
  })
  if (!upstream.ok && upstream.status !== 206) return new NextResponse('Unable to fetch recording', { status: upstream.status })

  const responseHeaders = new Headers()
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }
  responseHeaders.set('Cache-Control', 'private, max-age=3600')
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders })
}
