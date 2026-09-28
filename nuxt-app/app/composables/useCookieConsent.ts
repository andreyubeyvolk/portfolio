// Visitor's analytics-cookie choice, shared between the banner and the
// analytics plugin. null = not asked yet. Persisted in localStorage (the
// choice itself isn't a cookie), wrapped in try/catch since storage can be
// blocked (private mode, disabled site data)--then the banner just shows
// again next visit and analytics stays off.
type Consent = 'granted' | 'denied' | null

const STORAGE_KEY = 'cookie-consent'

export function useCookieConsent() {
  const consent = useState<Consent>('cookieConsent', () => null)

  function read() {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      consent.value = v === 'granted' || v === 'denied' ? v : null
    } catch {
      consent.value = null
    }
  }

  function choose(value: 'granted' | 'denied') {
    consent.value = value
    try { localStorage.setItem(STORAGE_KEY, value) } catch {}
  }

  return { consent, read, choose }
}
