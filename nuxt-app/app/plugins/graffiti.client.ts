// Ctrl+drag spray-can tagging (see public/graffiti.js). Every static
// page set window.GRAFFITI_CLEAR_EFFECT = 'wipe' before loading the
// script; every page uses 'wipe' in practice, so it's just hardcoded
// here instead of threaded through as a per-page option nothing
// actually varies yet.
//
// graffiti.js targets whichever page's .content-pane/.content-pane__scroll
// it finds via querySelector at init time—correct once per static page
// load, but that target is a different DOM node after every client-side
// navigation here. Re-running init (after tearing down the previous
// instance) on every navigation keeps it pointed at the current page's
// pane instead of a detached one from the page just left.
declare global {
  interface Window {
    GRAFFITI_CLEAR_EFFECT?: string
    initGraffiti?: () => () => void
    clearGraffiti?: () => void
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  window.GRAFFITI_CLEAR_EFFECT = 'wipe'

  let destroy: (() => void) | null = null

  function restart() {
    destroy?.()
    destroy = window.initGraffiti ? window.initGraffiti() : null
  }

  nuxtApp.hook('app:suspense:resolve', restart)
  nuxtApp.hook('page:finish', restart)
})
