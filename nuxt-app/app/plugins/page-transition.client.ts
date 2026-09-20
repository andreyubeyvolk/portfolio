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
// both get the curtain, not just section<->section. 'all-projects' joins
// it too, per the user's own report: leaving/entering it from any OTHER
// section (or home) was falling through to 'none' (plain cross-fade)
// since it matched neither the section-curtain check nor the project-
// panel one. It still correctly gets the SMALLER panel treatment
// against a project specifically (isProjectPanelPeer, checked first
// below)--adding it here only affects its pairing with genuine sections.
const SECTION_ROUTE_NAMES = new Set(['index', 'inhouse', 'brands', 'archive', 'about', 'all-projects'])
const PROJECT_ROUTE_NAMES = new Set(['inhouse-slug', 'brands-slug'])
// Which listing a project's own panel transition is allowed to pair
// with--its own section's listing, or all-projects (which lists every
// project and has always legitimately gotten the panel treatment too).
// Anything else--another section entirely (About, Archive, Home, the
// OTHER section)--isn't a panel relationship at all, even though one
// side happens to be a project route.
const PROJECT_OWN_SECTION: Record<string, string> = { 'inhouse-slug': 'inhouse', 'brands-slug': 'brands' }
function isProjectPanelPeer(projectName: string, otherName: string) {
  return otherName === 'all-projects' || PROJECT_OWN_SECTION[projectName] === otherName
}

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
    const toIsProject = PROJECT_ROUTE_NAMES.has(toName)
    const fromIsProject = PROJECT_ROUTE_NAMES.has(fromName)

    // Hierarchy: a project's panel transition (open/close within
    // .content-pane) only makes sense against a listing that actually
    // shares that panel--its own section, or all-projects. Anything else
    // is really a menu-level jump to a DIFFERENT section, even when one
    // side happens to be a project page (e.g. leaving a project via the
    // nav menu straight to About, or to Archive)--per the user's own
    // framing, "это по факту переход в другой раздел меню", so it gets
    // the same full curtain a section<->section nav gets, not the
    // smaller content-pane panel effect. Checked BEFORE the panel cases
    // below so a project<->its-own-listing pair (which IS also
    // "SECTION_ROUTE_NAMES has one side") still correctly falls through
    // to panel treatment instead.
    let type = 'none'
    if (toIsProject && !fromIsProject && isProjectPanelPeer(toName, fromName)) {
      type = 'project-open-panel'
    } else if (fromIsProject && !toIsProject && isProjectPanelPeer(fromName, toName)) {
      type = 'project-close-panel'
    } else if (SECTION_ROUTE_NAMES.has(toName) && SECTION_ROUTE_NAMES.has(fromName) && toName !== fromName) {
      type = 'curtain'
    } else if (toIsProject !== fromIsProject && (SECTION_ROUTE_NAMES.has(toName) || SECTION_ROUTE_NAMES.has(fromName))) {
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
