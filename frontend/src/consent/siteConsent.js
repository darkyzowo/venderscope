export const CONSENT_COOKIE_NAME = 'vs_cookie_consent'
export const CONSENT_ACCEPTED = 'accepted'
export const CONSENT_DECLINED = 'declined'
export const CONSENT_SETTINGS_EVENT = 'vs:open-cookie-settings'

const CONSENT_MAX_AGE = 60 * 60 * 24 * 180
const OPTIONAL_STORAGE_PREFIX = 'vs_optional_'

export function readSiteConsent() {
  if (typeof document === 'undefined') return null
  const entry = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${CONSENT_COOKIE_NAME}=`))
  if (!entry) return null
  const value = decodeURIComponent(entry.split('=')[1] || '')
  return value === CONSENT_ACCEPTED || value === CONSENT_DECLINED ? value : null
}

export function writeSiteConsent(value) {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`
}

export function canUseOptionalStorage(consent) {
  return consent === CONSENT_ACCEPTED
}

export function clearOptionalClientStorage() {
  if (typeof window === 'undefined') return

  try {
    const localKeys = Object.keys(window.localStorage).filter((key) => key.startsWith(OPTIONAL_STORAGE_PREFIX))
    for (const key of localKeys) window.localStorage.removeItem(key)
  } catch {
    // Ignore storage access issues in restricted browser modes.
  }

  try {
    const sessionKeys = Object.keys(window.sessionStorage).filter((key) => key.startsWith(OPTIONAL_STORAGE_PREFIX))
    for (const key of sessionKeys) window.sessionStorage.removeItem(key)
  } catch {
    // Ignore storage access issues in restricted browser modes.
  }

  if (typeof document !== 'undefined') {
    for (const part of document.cookie.split('; ')) {
      const [name] = part.split('=')
      if (name?.startsWith('vs_opt_')) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
      }
    }
  }
}
