import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('[API] /api/chatwoot-webhook - Webhook received')

  try {
    const payload = await request.json()
    const { event, id: contactId, phone_number: currentPhoneNumber, contact_inboxes } = payload

    // We only process contact_created events
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
