// Visitor's analytics-cookie choice, shared between the banner and the
// analytics plugin. null = not asked yet. Persisted in localStorage (the
// choice itself isn't a cookie), wrapped in try/catch since storage can be
// blocked (private mode, disabled site data)--then the banner just shows
// again next visit and analytics stays off.
type Consent = 'granted' | 'denied' | null

const STORAGE_KEY = 'cookie-consent'

// Cookie-consent banners are a legal requirement in the EU/EEA + UK +
// Switzerland (ePrivacy Directive/GDPR), not a global norm--showing it
// everywhere is exactly the "unnecessary distraction" the site is trying
// to avoid. There's no backend here to geo-IP the request (static
// generate + GitHub Pages), and a third-party IP-lookup API would itself
// be a network call made before the visitor has agreed to anything--so
// this uses the browser's own IANA timezone as a client-only, no-network
// proxy for "is this visitor in a region that legally requires the
// prompt". Europe/* covers every EU/EEA/UK/Switzerland zone; it also
// covers a handful of non-EU countries that share the continent
// (Russia, Ukraine, Turkey, the Balkans)--an acceptable false positive
// (an extra click for a few visitors) against the alternative of a false
// negative (skipping a legally required prompt). VPNs/travelers can still
// fool this either way; that's inherent to any client-side geo signal.
export function regionRequiresConsent(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone.startsWith('Europe/')
  } catch {
    // Can't tell--default to showing it rather than silently skipping a
    // legally required prompt.
    return true
  }
}

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
