// Google Analytics. Gated to the real domain so local dev/preview traffic
// never reaches the production GA property.
//
// Consent gating only applies where the cookie-consent prompt is legally
// required (see regionRequiresConsent--EU/EEA/UK/Switzerland, by timezone):
// there, GA loads only after Accept in CookieBanner, and never after
// Decline. Everywhere else the banner never shows at all (nothing to
// distract from), so GA just loads normally--an explicit prior Decline is
// still honored if present (e.g. a visitor who chose it while the region
// check matched on an earlier visit).
//
// send_page_view is off in the config call; every pageview is sent from
// router.afterEach instead, since gtag's own automatic pageview only fires
// once, on the initial script load, and would never see later client-side
// navigations on this SPA.
const MEASUREMENT_ID = 'G-SXEF693HCE'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  if (window.location.hostname !== 'andreyubeyvolk.com') return

  const { consent, read } = useCookieConsent()
  read()

  let loaded = false

  function sendPageView() {
    window.gtag!('event', 'page_view', {
      page_location: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
    })
  }

  function load() {
    if (loaded) return
    loaded = true
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args)
    }
    window.gtag('js', new Date())
    window.gtag('config', MEASUREMENT_ID, { send_page_view: false })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
    document.head.appendChild(script)
  }

  // Explicit prior decline always wins, regardless of region (see header
  // comment). Otherwise: load immediately outside a consent-required
  // region, or if a required region's visitor already accepted.
  if (consent.value !== 'denied' && (consent.value === 'granted' || !regionRequiresConsent())) {
    load()
  }

  // Accepted on this visit (CookieBanner, consent-required region only):
  // load, and report the page they're already on (its own navigation
  // happened before GA existed).
  watch(consent, (value) => {
    if (value !== 'granted' || loaded) return
    load()
    sendPageView()
  })

  const router = useRouter()
  router.afterEach(async () => {
    if (!loaded) return
    await nextTick()
    sendPageView()
  })
})
