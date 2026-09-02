import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('[API] /api/chatwoot-webhook - Webhook received')

  try {
    const payload = await request.json()
    const { event, id: contactId, phone_number: currentPhoneNumber, contact_inboxes } = payload

    // 1. Handle message_created events (incoming customer responses from Chatwoot)
    if (event === 'message_created') {
      const messageType = payload.message_type
      const content = payload.content
      const sender = payload.sender
      const conversation = payload.conversation

      // Only process incoming customer messages (message_type === 'incoming' or 0)
      if ((messageType === 'incoming' || messageType === 0) && content) {
        const rawPhone = sender?.phone_number || conversation?.meta?.sender?.phone_number || ''
        const cleanPhone = rawPhone.replace('whatsapp:', '').trim()
        const senderName = sender?.name || payload.account?.name || null

        console.log(`[API] /api/chatwoot-webhook - Received incoming message from Chatwoot for phone: ${cleanPhone}`)

        if (cleanPhone) {
          // Look up customer in Supabase
          let customerId: string | null = null
          const { data: customerMatch } = await supabaseAdmin
            .from('customers')
            .select('id')
            .eq('phone_number', cleanPhone)
            .maybeSingle()

          if (customerMatch) {
            customerId = customerMatch.id
          }

          // Save reply into whatsapp_replies table
          await supabaseAdmin
            .from('whatsapp_replies')
            .insert({
              customer_id: customerId,
              phone_number: cleanPhone,
              profile_name: senderName,
              message_body: content.trim(),
              message_sid: payload.id ? String(payload.id) : null,
            })

          console.log(`[API] /api/chatwoot-webhook - Saved Chatwoot incoming message to whatsapp_replies in Supabase`)
        }
      }

      return NextResponse.json({ message: 'Message event processed' }, { status: 200 })
    }

    // 2. We only process contact_created events for phone number syncing
    if (event !== 'contact_created') {
      console.log(`[API] /api/chatwoot-webhook - Skipping event: ${event}`)
      return NextResponse.json({ message: `Skipping event: ${event}` }, { status: 200 })
    }

    console.log(`[API] /api/chatwoot-webhook - Processing contact_created for contact ID: ${contactId}`)

    // If the contact already has a phone number, no need to overwrite it
    if (currentPhoneNumber) {
      console.log(`[API] /api/chatwoot-webhook - Contact ${contactId} already has phone number: ${currentPhoneNumber}`)
      return NextResponse.json({ message: 'Contact already has a phone number' }, { status: 200 })
    }

    // Look for a WhatsApp source ID in the contact_inboxes list
    const whatsappInbox = contact_inboxes?.find((item: any) => 
      item.source_id && typeof item.source_id === 'string' && item.source_id.startsWith('whatsapp:')
    )

    if (!whatsappInbox) {
      console.log(`[API] /api/chatwoot-webhook - No WhatsApp inbox found for contact ${contactId}`)
      return NextResponse.json({ message: 'No WhatsApp inbox found' }, { status: 200 })
    }

    const sourceId = whatsappInbox.source_id
    // Extract the raw phone number (remove "whatsapp:" prefix)
    const rawPhoneNumber = sourceId.replace('whatsapp:', '').trim()

    if (!rawPhoneNumber) {
      console.log(`[API] /api/chatwoot-webhook - WhatsApp source_id was empty for contact ${contactId}`)
      return NextResponse.json({ message: 'WhatsApp source ID is empty' }, { status: 200 })
    }

    console.log(`[API] /api/chatwoot-webhook - Found WhatsApp number: ${rawPhoneNumber} for contact ${contactId}`)

    // Retrieve API configurations
    const chatwootApiUrl = process.env.CHATWOOT_API_URL || 'https://app.chatwoot.com'
    const chatwootToken = process.env.CHATWOOT_API_ACCESS_TOKEN
    const accountId = payload.account_id || payload.account?.id

    if (!chatwootToken) {
      console.error('[API] /api/chatwoot-webhook - CHATWOOT_API_ACCESS_TOKEN is not configured')
      return NextResponse.json({ error: 'Chatwoot access token missing' }, { status: 500 })
    }

    if (!accountId) {
      console.error('[API] /api/chatwoot-webhook - Account ID is missing in webhook payload')
      return NextResponse.json({ error: 'Account ID missing in payload' }, { status: 400 })
    }

    // Call Chatwoot REST API to update the contact's phone number
    const updateUrl = `${chatwootApiUrl.replace(/\/$/, '')}/api/v1/accounts/${accountId}/contacts/${contactId}`
    console.log(`[API] /api/chatwoot-webhook - Updating contact via API: ${updateUrl}`)

    const response = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': chatwootToken,
      },
      body: JSON.stringify({
        phone_number: rawPhoneNumber,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[API] /api/chatwoot-webhook - Failed to update contact ${contactId}:`, errorText)
      return NextResponse.json({ error: 'Failed to update contact in Chatwoot', details: errorText }, { status: response.status })
    }

    const updatedContact = await response.json()
    console.log(`[API] /api/chatwoot-webhook - Successfully updated phone number for contact ${contactId} to ${rawPhoneNumber}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Phone number updated successfully', 
      contact: updatedContact 
    }, { status: 200 })

  } catch (error: any) {
    console.error('[API] /api/chatwoot-webhook - Error handling webhook:', error.message || error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
