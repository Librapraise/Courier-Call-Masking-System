import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      )
    }

    const trimmedEmail = email.trim().toLowerCase()

    // Determine base URL from headers or fallback
    const origin = request.headers.get('origin') || request.headers.get('host') || 'http://localhost:3000'
    const protocol = origin.startsWith('http') ? '' : 'http://'
    const baseUrl = `${protocol}${origin}`
    const redirectTo = `${baseUrl}/reset-password`

    // Request Supabase password reset email
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo
    })

    if (resetError) {
      console.warn('[GhostCRM Auth] resetPasswordForEmail warning:', resetError.message)
    }

    // Also generate recovery link for local environment debugging
    try {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: trimmedEmail,
        options: {
          redirectTo
        }
      })

      if (!linkError && linkData?.properties?.action_link && process.env.NODE_ENV !== 'production') {
        console.log(`[GhostCRM Auth - Dev Only] Generated recovery link for ${trimmedEmail}:`, linkData.properties.action_link)
      }
    } catch (genErr) {
      // non-fatal in production
    }

    return NextResponse.json({
      success: true,
      message: `If an account with ${trimmedEmail} exists, a password reset link has been dispatched.`
    })
  } catch (err: any) {
    console.error('[GhostCRM Auth] Forgot password error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to process password reset request.' },
      { status: 500 }
    )
  }
}
