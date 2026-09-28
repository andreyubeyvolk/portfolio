// Google Analytics, loaded only after the visitor accepts analytics cookies
// in CookieBanner (no gtag.js request at all before that, and none ever
// after Decline). Gated to the real domain so local dev/preview traffic
// never reaches the production GA property.
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

  // Returning visitor who already accepted: load now--the first
  // router.afterEach below reports this page, same as any navigation.
  if (consent.value === 'granted') load()

  // Accepted on this visit: load, and report the page they're already on
  // (its own navigation happened before GA existed).
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
