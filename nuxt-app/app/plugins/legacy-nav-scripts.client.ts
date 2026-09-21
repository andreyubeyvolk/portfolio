// Runs the ported-as-is static-site nav scripts (menu.js/logo-scrub.js/
// mobile-logo-swipe.js) once, strictly after Vue's own hydration finishes.
//
// These files mutate the DOM directly (classList.add, attribute changes)
// the instant they execute. Loading them as an ordinary <script> tag races
// Vue's hydration: if the script runs first, hydration sees "extra"
// classes on elements it's about to hydrate and logs a mismatch warning
// (harmless in practice, but a real symptom of a real race). Deferring to
// app:mounted sidesteps the race entirely instead of trying to win it.
declare global {
  interface Window {
    reapplyMobileBrandLettering?: () => void
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  let injected = false

  // app:mounted alone isn't late enough: NuxtLayout/NuxtPage render inside
  // a <Suspense>, whose own hydration can still be resolving async work
  // after the outer app has "mounted". app:suspense:resolve is Nuxt's own
  // signal for exactly that boundary settling—waiting for it (once) is
  // what actually guarantees hydration is done before these scripts touch
  // the DOM.
  nuxtApp.hook('app:suspense:resolve', () => {
    if (injected) return
    injected = true
    ;['/menu.js', '/logo-scrub.js', '/mobile-logo-swipe.js'].forEach((src) => {
      const script = document.createElement('script')
      script.src = src
      document.body.appendChild(script)
    })
  })

  // mobile-logo-swipe.js's chosen lettering survives in sessionStorage
  // across navigations, but the DOM class showing it doesn't: .mobile-
  // bar__brand is a NuxtLink, and Vue re-patches its whole `class`
  // attribute on every route change (to toggle its own router-link-
  // active state), silently dropping the is-lettering class this script
  // added outside Vue's own reactivity. Re-applying from storage after
  // each navigation fixes the visible reset without re-running the
  // script itself--same page:finish pattern graffiti.client.ts uses for
  // its own per-navigation re-init.
  nuxtApp.hook('page:finish', () => {
    window.reapplyMobileBrandLettering?.()
  })
})
