import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('[API] /api/chatwoot-sync-past - Starting sync of past contacts')

  try {
    const { searchParams } = new URL(request.url)
    let accountId = process.env.CHATWOOT_ACCOUNT_ID || searchParams.get('accountId')

    if (!accountId || accountId === 'your_account_id_here') {
      accountId = searchParams.get('accountId')
    }

    if (!accountId) {
      return NextResponse.json({ 
        error: 'Missing Chatwoot Account ID. Please configure CHATWOOT_ACCOUNT_ID in env or pass it as a query parameter: ?accountId=XXXXX' 
      }, { status: 400 })
    }

    const chatwootApiUrl = process.env.CHATWOOT_API_URL || 'https://app.chatwoot.com'
    const chatwootToken = process.env.CHATWOOT_API_ACCESS_TOKEN

    if (!chatwootToken || chatwootToken === 'your_access_token_here') {
      return NextResponse.json({ error: 'Chatwoot access token is not configured in environment variables' }, { status: 500 })
    }

    const baseUrl = chatwootApiUrl.replace(/\/$/, '')
    let page = 1
    let totalUpdated = 0
    const updatedContactsList: any[] = []
    let hasMore = true

    const allContactsDebug: any[] = []

    console.log(`[API] /api/chatwoot-sync-past - Fetching contacts for account ${accountId} starting from page ${page}`)

    while (hasMore && page <= 10) { // Limit to 10 pages safety
      const listUrl = `${baseUrl}/api/v1/accounts/${accountId}/contacts?page=${page}`
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': chatwootToken,
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[API] /api/chatwoot-sync-past - Failed to fetch contacts on page ${page}:`, errorText)
        return NextResponse.json({ error: `Failed to fetch contacts on page ${page}`, details: errorText }, { status: response.status })
      }

      const data = await response.json()
      const contacts = data.payload || []

      if (contacts.length === 0) {
        hasMore = false
        break
      }

      for (const contact of contacts) {
        allContactsDebug.push({
          id: contact.id,
          name: contact.name,
          phone_number: contact.phone_number,
          contact_inboxes: contact.contact_inboxes?.map((ci: any) => ci.source_id)
        })

        // If phone number is empty/blank
        if (!contact.phone_number) {
          const whatsappInbox = contact.contact_inboxes?.find((item: any) => 
            item.source_id && typeof item.source_id === 'string' && item.source_id.startsWith('whatsapp:')
          )

          if (whatsappInbox) {
            const rawPhoneNumber = whatsappInbox.source_id.replace('whatsapp:', '').trim()
            if (rawPhoneNumber) {
              console.log(`[API] /api/chatwoot-sync-past - Syncing phone number ${rawPhoneNumber} for contact: ${contact.name || contact.id}`)
              
              // Call API to update the contact's phone number
              const updateUrl = `${baseUrl}/api/v1/accounts/${accountId}/contacts/${contact.id}`
              const updateResponse = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'api_access_token': chatwootToken,
                },
                body: JSON.stringify({
                  phone_number: rawPhoneNumber
                })
              })

              if (updateResponse.ok) {
                totalUpdated++
                updatedContactsList.push({
                  id: contact.id,
                  name: contact.name || 'Unnamed Contact',
                  phone_number: rawPhoneNumber
                })
              } else {
                console.error(`[API] /api/chatwoot-sync-past - Failed to update contact ${contact.id}:`, await updateResponse.text())
              }
            }
          }
        }
      }

      // Check if we need to continue to the next page
      const meta = data.meta || {}
      if (meta.current_page && meta.total_count) {
        const totalFetched = page * 15 // Chatwoot default page size is 15
        hasMore = totalFetched < meta.total_count
      } else {
        hasMore = false
      }

      page++
    }

    return NextResponse.json({
      success: true,
      message: `Completed sync. Updated ${totalUpdated} existing contacts.`,
      updatedContacts: updatedContactsList,
      debugAllContacts: allContactsDebug
    }, { status: 200 })

  } catch (error: any) {
    console.error('[API] /api/chatwoot-sync-past - Error:', error.message || error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
