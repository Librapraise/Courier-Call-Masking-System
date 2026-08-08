import { NextRequest } from 'next/server'
import twilio from 'twilio'

/**
 * Validates that a request is from Twilio
 * Uses Twilio's signature validation to ensure webhook authenticity
 * For POST requests, form data is used for validation
 */
export async function validateTwilioWebhook(
  request: NextRequest,
  formData?: FormData
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not configured')
    return false
  }

  // Get the signature from the request header
  const signature = request.headers.get('X-Twilio-Signature')
  if (!signature) {
    console.error('Missing X-Twilio-Signature header')
    return false
  }

  // Validate against the same public URL sent to Twilio. On hosted platforms,
  // request.url can contain an internal host/protocol that Twilio did not sign.
  const incomingUrl = new URL(request.url)
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const callbackUrl = configuredOrigin
    ? `${configuredOrigin}${incomingUrl.pathname}${incomingUrl.search}`
    : request.url

  // For POST requests, get form data
  if (request.method === 'POST') {
    try {
      // Use provided formData or read from request
      const data = formData || await request.formData()
      const params: Record<string, string> = {}
      data.forEach((value, key) => {
        params[key] = value.toString()
      })
      
      // Query parameters are already part of callbackUrl. Twilio's validator
      // expects only form fields here; adding query fields counts them twice.
      return twilio.validateRequest(authToken, signature, callbackUrl, params)
    } catch (error) {
      console.error('Twilio signature validation error:', error)
      return false
    }
  } else {
    // For GET requests, use query params
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    return twilio.validateRequest(authToken, signature, callbackUrl, params)
  }
}

/**
 * Masks a phone number to show only last 4 digits
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) {
    return '****'
  }
  return '****' + phone.slice(-4)
}

/**
 * Retry logic wrapper for async functions
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries')
}
