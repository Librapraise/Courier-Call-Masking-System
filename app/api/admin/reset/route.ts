import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Daily reset endpoint
 * Archives current day's data and clears customer list
 * Can be triggered manually or by cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    let user = null
    let authError = null

    const body = await request.json().catch(() => ({}))
    const { accessToken } = body

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
            setAll() {},
          },
        }
      )
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
    }

    // For cron jobs, allow if there's a secret token
    const cronSecret = request.headers.get('X-Cron-Secret')
    const isCronJob = cronSecret === process.env.CRON_SECRET

    if (!isCronJob && (authError || !user)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify admin role (skip for cron jobs)
    if (!isCronJob) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Only admins can reset the list' },
          { status: 403 }
        )
      }
    }

    const today = new Date()
    const archiveDate = today.toISOString().split('T')[0] // YYYY-MM-DD

    // Step 1: Archive call logs
    const { data: callLogs } = await supabaseAdmin
      .from('call_logs')
      .select('*')

    if (callLogs && callLogs.length > 0) {
      const archivedCalls = callLogs.map(log => ({
        original_call_log_id: log.id,
        customer_id: log.customer_id,
        customer_name: log.customer_name,
        customer_phone_masked: log.customer_phone_masked,
        courier_id: log.courier_id,
        call_status: log.call_status,
        call_timestamp: log.call_timestamp,
        call_duration: log.call_duration,
        twilio_call_sid: log.twilio_call_sid,
        agent_name: log.agent_name,
        error_message: log.error_message,
        archive_date: archiveDate,
      }))

      await supabaseAdmin.from('archived_calls').insert(archivedCalls)
    }

    // Step 2: Clear call logs
    await supabaseAdmin.from('call_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Step 3: Deactivate all customers (soft delete)
    await supabaseAdmin
      .from('customers')
      .update({ is_active: false })
      .eq('is_active', true)

    // Step 4: Update last reset date in settings
    await supabaseAdmin
      .from('settings')
      .update({ value: archiveDate })
      .eq('key', 'last_reset_date')

    return NextResponse.json({
      success: true,
      message: 'Daily reset completed successfully',
      archived_calls: callLogs?.length || 0,
      reset_date: archiveDate,
    })
  } catch (error: any) {
    console.error('Reset error:', error)
    return NextResponse.json(
      { error: `Reset failed: ${error.message}` },
      { status: 500 }
    )
  }
}

