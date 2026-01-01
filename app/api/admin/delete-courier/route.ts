import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Get the access token from the request
    const body = await request.json()
    const { courierId, accessToken } = body

    if (!courierId) {
      return NextResponse.json(
        { error: 'Missing required parameter: courierId' },
        { status: 400 }
      )
    }

    // Verify user is authenticated and is an admin
    let user = null
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
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Verify user is an admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Prevent self-deletion
    if (user.id === courierId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    // Delete the courier's profile using admin client (bypasses RLS)
    // This will cascade delete related records due to foreign keys
    const { error: deleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', courierId)

    if (deleteError) {
      console.error('Error deleting courier profile:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete courier', details: deleteError.message },
        { status: 500 }
      )
    }

    // Also try to delete the auth user (requires service role key)
    try {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.deleteUser(courierId)
      if (authError) {
        console.warn('Could not delete auth user:', authError)
        // Continue anyway - profile is deleted
      }
    } catch (authErr) {
      console.warn('Auth user deletion failed (may require additional permissions):', authErr)
      // Continue anyway - profile is deleted
    }

    return NextResponse.json({
      success: true,
      message: 'Courier deleted successfully'
    })
  } catch (error: any) {
    console.error('Error in delete-courier API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

