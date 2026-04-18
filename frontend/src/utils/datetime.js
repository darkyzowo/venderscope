const ISO_WITH_TIMEZONE = /(Z|[+-]\d{2}:\d{2})$/i

export function parseApiDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value !== 'string') return new Date(value)

  // Backend timestamps can arrive as UTC without a trailing timezone.
  // Treat those as UTC explicitly so relative time is correct in local browsers.
  const normalised = ISO_WITH_TIMEZONE.test(value) ? value : `${value}Z`
  const parsed = new Date(normalised)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatApiDate(value, locales = [], options = {}) {
  const parsed = parseApiDate(value)
  return parsed ? parsed.toLocaleDateString(locales, options) : ''
}

export function formatApiDateTime(value, locales = [], options = {}) {
  const parsed = parseApiDate(value)
  return parsed ? parsed.toLocaleString(locales, options) : ''
}
