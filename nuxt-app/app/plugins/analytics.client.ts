// gtag.js itself is loaded as a plain <script> in nuxt.config.ts--this
// plugin does the actual init and keeps GA in sync with Vue Router.
//
// send_page_view is turned off in the config call and every pageview
// (including the first) is instead sent from router.afterEach--gtag's own
// automatic pageview only fires once, on the initial script load, and
// would never see any later client-side navigation on this SPA. Routing
// everything through one path also avoids double-counting the first page.
//
// Gated to the real domain so local dev/preview traffic never reaches the
// production GA property.
const MEASUREMENT_ID = 'G-SXEF693HCE'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  if (window.location.hostname !== 'andreyubeyvolk.com') return

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })

  const router = useRouter()
  router.afterEach(async () => {
    await nextTick()
    window.gtag!('event', 'page_view', {
      page_location: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
    })
  })
})
