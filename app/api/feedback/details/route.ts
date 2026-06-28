import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const customerId = request.nextUrl.searchParams.get('customerId')

  if (!customerId) {
    return NextResponse.json(
      { error: 'Missing customerId parameter' },
      { status: 400 }
    )
  }

  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID format' },
        { status: 400 }
      )
    }

    // Retrieve customer
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, name, assigned_courier_id, is_active')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.error('[API] /api/feedback/details - Customer not found:', customerError?.message)
      return NextResponse.json(
        { error: 'Customer not found or invalid feedback link' },
        { status: 404 }
      )
    }

    // Check if feedback already exists
    const { data: existingFeedback, error: feedbackError } = await supabaseAdmin
      .from('feedback')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle()

    if (feedbackError) {
      console.error('[API] /api/feedback/details - Feedback query error:', feedbackError.message)
    }

    // Get courier name
    let courierName = 'your courier'
    if (customer.assigned_courier_id) {
      const { data: courier } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', customer.assigned_courier_id)
        .single()
      
      if (courier?.email) {
        const localPart = courier.email.split('@')[0]
        courierName = localPart
          .split(/[\._-]/)
          .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      }
    }

    return NextResponse.json({
      customerName: customer.name,
      courierName,
      alreadySubmitted: !!existingFeedback,
    })
  } catch (error: any) {
    console.error('[API] /api/feedback/details - Unexpected error:', error.message || error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
