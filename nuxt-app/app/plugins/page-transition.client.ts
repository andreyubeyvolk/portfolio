// Classifies every client-side route change so page-transitions.css
// knows which View Transition effect to play (see that file's own
// header). Runs in a router.beforeEach guard--before Vue Router
// resolves the new route/swaps components--so by the time Nuxt's own
// viewTransition wiring calls document.startViewTransition() a moment
// later, both documentElement.dataset.transition AND the shared
// pageTransitionType state below already reflect this navigation's
// target.
//
// 'home' joins the section set--logo-to-home and home-to-section nav
// both get the curtain, not just section<->section.
const SECTION_ROUTE_NAMES = new Set(['index', 'inhouse', 'brands', 'archive', 'about'])
const PROJECT_ROUTE_NAMES = new Set(['inhouse-slug', 'brands-slug'])

// Nuxt's own view-transitions.client.js attaches a .catch() to
// transition.finished but not to transition.ready--if the browser ever
// aborts a transition (overlapping navigations from an impatient
// double-click, or the tab being backgrounded mid-navigation), that
// rejection surfaces as an unhandled promise rejection in the console.
// The nav itself still completes fine either way (Nuxt's own
// page:finish-driven fallback doesn't depend on `ready`), so this just
// silences that console noise rather than changing any behavior.
if (typeof document !== 'undefined' && document.startViewTransition) {
  const nativeStartViewTransition = document.startViewTransition.bind(document)
  document.startViewTransition = ((callbackOrOptions: unknown) => {
    const transition = nativeStartViewTransition(callbackOrOptions as never)
    transition.ready.catch(() => {})
    return transition
  }) as typeof document.startViewTransition
}

function isDesktop() {
  return window.matchMedia('(min-width: 981px)').matches
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  // Shared with usePanelTransitionStyle.ts (content-pane curtain, keyed
  // by transition type)--see that file for why a plain unconditional
  // "is this a project page" check isn't enough: a view-transition-name
  // left on an element during an UNRELATED transition (e.g. a project's
  // listing card during a section curtain) creates its own extra,
  // unclipped animated layer floating on top of whatever else is
  // happening. This only carries a real value for the ONE navigation it
  // actually applies to.
  const pageTransitionType = useState<string>('pageTransitionType', () => 'none')

  router.beforeEach(async (to, from) => {
    // The initial hydration "navigation": Nuxt pre-resolves the current
    // URL into `from` before Vue Router's own state machine considers
    // anything "current" yet, so this ISN'T Vue Router's usual
    // START_LOCATION sentinel (empty `matched`, `name` undefined) the
    // way a plain Vue Router app would see--`from.matched` already has
    // an entry here, just with no name resolved on it (confirmed by
    // logging to/from during a fresh hard load: fromName is undefined,
    // fromMatchedLen is 1). Checking fullPath equality instead is what
    // actually distinguishes it: a real navigation always changes the
    // URL, this pseudo-one doesn't (to and from are the same page).
    // Skipping it matters: classifying it as a real transition set
    // pageTransitionType to something the server-rendered HTML never
    // had--a real hydration mismatch on the very first paint (caught
    // live: .content-pane got a stray view-transition-name style server
    // never rendered).
    if (to.fullPath === from.fullPath) return
    const html = document.documentElement

    // Mobile/tablet: curtains stay desktop-only for now ("шторки
    // убираем, делаем переходы между страницами просто плавным
    // опасити")--plain 'none' here means no CSS override matches, so
    // the browser's own default cross-fade plays instead. The mobile
    // hamburger menu's own open/close animation (menu.js/mobile.css) is
    // untouched--that's a separate, non-routed overlay, not a page
    // transition at all.
    if (!isDesktop()) {
      pageTransitionType.value = 'none'
      await nextTick()
      html.dataset.transition = 'none'
      return
    }

    const toName = String(to.name ?? '')
    const fromName = String(from.name ?? '')

    let type = 'none'
    if (PROJECT_ROUTE_NAMES.has(toName) && !PROJECT_ROUTE_NAMES.has(fromName)) {
      type = 'project-open-panel'
    } else if (PROJECT_ROUTE_NAMES.has(fromName) && !PROJECT_ROUTE_NAMES.has(toName)) {
      type = 'project-close-panel'
    } else if (SECTION_ROUTE_NAMES.has(toName) && SECTION_ROUTE_NAMES.has(fromName) && toName !== fromName) {
      type = 'curtain'
    }

    pageTransitionType.value = type
    // Drives the :style binding on the already-MOUNTED .content-pane
    // (the currently-visible listing's or project page's) for the
    // transition's "old" side. Vue's reactivity normally flushes that
    // DOM patch on a microtask, not synchronously--awaiting nextTick()
    // here guarantees it's actually landed before we return control to
    // Nuxt's own beforeResolve guard (registered separately, always
    // runs AFTER every beforeEach guard per Vue Router's own ordering),
    // which is what calls document.startViewTransition() and takes the
    // "old" snapshot. The "new" side needs no such wait--it's a fresh
    // mount that simply reads whatever this ref holds at that later
    // point.
    await nextTick()
    html.dataset.transition = type
  })
})
