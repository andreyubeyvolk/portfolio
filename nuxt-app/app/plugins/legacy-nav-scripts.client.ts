// Runs the ported-as-is static-site nav scripts (menu.js/logo-scrub.js/
// mobile-logo-swipe.js) once, strictly after Vue's own hydration finishes.
//
// These files mutate the DOM directly (classList.add, attribute changes)
// the instant they execute. Loading them as an ordinary <script> tag races
// Vue's hydration: if the script runs first, hydration sees "extra"
// classes on elements it's about to hydrate and logs a mismatch warning
// (harmless in practice, but a real symptom of a real race). Deferring to
// app:mounted sidesteps the race entirely instead of trying to win it.
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
})
