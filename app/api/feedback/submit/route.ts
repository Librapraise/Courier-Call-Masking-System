import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('[API] /api/feedback/submit - Feedback submission received')
  try {
    const body = await request.json()
    const { customerId, deliveryTimeRating, productQualityRating, comment } = body

    if (!customerId || !deliveryTimeRating || !productQualityRating) {
      return NextResponse.json(
        { error: 'Missing required fields: customerId, deliveryTimeRating, productQualityRating' },
        { status: 400 }
      )
    }

    // Validate ratings
    const dRating = parseInt(deliveryTimeRating)
    const pRating = parseInt(productQualityRating)

    if (isNaN(dRating) || dRating < 1 || dRating > 5 || isNaN(pRating) || pRating < 1 || pRating > 5) {
      return NextResponse.json(
        { error: 'Ratings must be integers between 1 and 5' },
        { status: 400 }
      )
    }

    // Fetch customer to check if they exist and get assigned courier
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, assigned_courier_id')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.error('[API] /api/feedback/submit - Customer not found:', customerError?.message)
      return NextResponse.json(
        { error: 'Invalid customer feedback session' },
        { status: 404 }
      )
    }

    // Check for duplicate feedback
    const { data: existingFeedback } = await supabaseAdmin
      .from('feedback')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle()

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback has already been submitted for this delivery' },
        { status: 409 }
      )
    }

    // Insert feedback
    const { error: insertError } = await supabaseAdmin
      .from('feedback')
      .insert({
        customer_id: customerId,
        courier_id: customer.assigned_courier_id,
        delivery_time_rating: dRating,
        product_quality_rating: pRating,
        comment: comment?.trim() || null,
      })

    if (insertError) {
      console.error('[API] /api/feedback/submit - Insert failed:', insertError.message)
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      )
    }

    console.log(`[API] /api/feedback/submit - Feedback saved for customer ${customerId}`)

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
    })
  } catch (error: any) {
    console.error('[API] /api/feedback/submit - Unexpected error:', error.message || error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
