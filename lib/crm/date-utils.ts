/**
 * Timezone & Shift Date Utilities for GhostCRM (Asia/Jerusalem)
 */

export const ISRAEL_TIMEZONE = 'Asia/Jerusalem'

/**
 * Returns the current date formatted as YYYY-MM-DD in Israel timezone.
 */
export function getIsraelDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

/**
 * Returns the UTC ISO string representing midnight (00:00:00) in Israel timezone for a given date.
 */
export function getIsraelMidnightIso(date: Date = new Date()): string {
  const dateStr = getIsraelDateString(date)
  const d = new Date(`${dateStr}T00:00:00Z`)
  const jerParts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(d)
  const jerHour = Number(jerParts.find(p => p.type === 'hour')?.value || 0)
  const jerMin = Number(jerParts.find(p => p.type === 'minute')?.value || 0)
  const offsetHours = (jerHour % 24)
  const israelMidnightUtc = new Date(d.getTime() - offsetHours * 3600 * 1000 - jerMin * 60 * 1000)
  return israelMidnightUtc.toISOString()
}

/**
 * Formats an ISO date string to a localized Israel date & time string.
 */
export function formatIsraelDateTime(isoOrDate: string | Date): string {
  if (!isoOrDate) return '—'
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  return d.toLocaleString('he-IL', {
    timeZone: ISRAEL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
