/**
 * Phone number utility functions for Israeli numbers
 */

const ISRAEL_COUNTRY_CODE = '+972'

/**
 * Formats a phone number for display (removes +972 prefix for Israeli numbers)
 * Example: +972501234567 -> 050-123-4567
 * Example: +1234567890 -> +1234567890 (non-Israeli numbers unchanged)
 */
export function formatPhoneForDisplay(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return ''
  
  // If it's an Israeli number (starts with +972), format it
  if (phoneNumber.startsWith(ISRAEL_COUNTRY_CODE)) {
    const numberWithoutPrefix = phoneNumber.substring(4) // Remove +972
    // Format as: 0XX-XXX-XXXX
    if (numberWithoutPrefix.length === 9) {
      return `${numberWithoutPrefix.substring(0, 3)}-${numberWithoutPrefix.substring(3, 6)}-${numberWithoutPrefix.substring(6)}`
    }
    // If it doesn't match expected format, return without prefix
    return numberWithoutPrefix
  }
  
  // For non-Israeli numbers, return as-is
  return phoneNumber
}

/**
 * Formats a phone number for storage (adds +972 prefix if missing)
 * Accepts formats like: 0501234567, 050-123-4567, +972501234567
 * Returns: +972501234567
 */
export function formatPhoneForStorage(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return ''
  
  // Remove any whitespace or dashes
  const cleaned = phoneNumber.trim().replace(/[\s-]/g, '')
  
  // If it already starts with +972, return as-is
  if (cleaned.startsWith(ISRAEL_COUNTRY_CODE)) {
    return cleaned
  }
  
  // If it starts with + but not +972, return as-is (international number)
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  
  // If it starts with 0 (Israeli local format), replace with +972
  if (cleaned.startsWith('0')) {
    return ISRAEL_COUNTRY_CODE + cleaned.substring(1)
  }
  
  // If it's just digits (9 digits for Israeli mobile), assume it's Israeli and add +972
  if (/^\d{9}$/.test(cleaned)) {
    return ISRAEL_COUNTRY_CODE + cleaned
  }
  
  // Otherwise, assume it's already in correct format or add + prefix
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned
}

/**
 * Validates if a phone number is in valid format (E.164 or Israeli local format)
 */
export function isValidPhoneFormat(phoneNumber: string): boolean {
  if (!phoneNumber) return false
  
  const cleaned = phoneNumber.trim().replace(/[\s-]/g, '')
  
  // E.164 format: + followed by 1-15 digits
  if (/^\+[1-9]\d{1,14}$/.test(cleaned)) {
    return true
  }
  
  // Israeli local format: 0 followed by 9 digits (mobile) or 8-9 digits (landline)
  if (/^0\d{8,9}$/.test(cleaned)) {
    return true
  }
  
  // Israeli number without leading 0: 9 digits
  if (/^\d{9}$/.test(cleaned)) {
    return true
  }
  
  return false
}

