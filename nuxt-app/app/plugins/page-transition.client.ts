// Classifies every client-side route change so page-transitions.css
// knows which View Transition effect to play (see that file's own
// header). Runs in a router.beforeEach guard--before Vue Router
// resolves the new route/swaps components--so by the time Nuxt's own
// viewTransition wiring calls document.startViewTransition() a moment
// later, both documentElement.dataset.transition AND the shared
// pageTransitionType/morphTargetSlug state below already reflect this
// navigation's target.
//
// 'home' now joins the section set--logo-to-home and home-to-section
// nav both get the curtain, per the user's own ask, not just
// section<->section.
const SECTION_ROUTE_NAMES = new Set(['index', 'inhouse', 'brands', 'archive', 'about'])
const PROJECT_ROUTE_NAMES = new Set(['inhouse-slug', 'brands-slug'])

// Cover-morph test scope--"попробуем морфинг, например айгейминге
// сначала": only these slugs carry a matching view-transition-name
// (ProjectCard.vue/ProjectPage.vue), so only their own open/close gets
// the full-cover morph. Every other project gets the plain content-pane
// curtain instead (project-open-panel/project-close-panel)--see
// page-transitions.css.
const MORPH_SLUGS = new Set(['igaming'])

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

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  // Shared with ProjectCard.vue/ProjectPage.vue (cover morph, keyed by
  // exact slug) and usePanelTransitionStyle.ts (content-pane curtain,
  // keyed by transition type)--see those files for why a plain
  // unconditional "is this the iGaming component" check isn't enough:
  // a view-transition-name left on an element during an UNRELATED
  // transition (e.g. iGaming's listing card during a section curtain)
  // creates its own extra, unclipped animated layer floating on top of
  // whatever else is happening. These two only carry a real value for
  // the ONE navigation they actually apply to.
  const morphTargetSlug = useState<string | null>('morphTargetSlug', () => null)
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
    // pageTransitionType/morphTargetSlug to something the
    // server-rendered HTML never had--a real hydration mismatch on the
    // very first paint (caught live: .content-pane got a stray
    // view-transition-name style server never rendered).
    if (to.fullPath === from.fullPath) return
    const html = document.documentElement
    const toName = String(to.name ?? '')
    const fromName = String(from.name ?? '')
    const toSlug = typeof to.params.slug === 'string' ? to.params.slug : undefined
    const fromSlug = typeof from.params.slug === 'string' ? from.params.slug : undefined

    let type = 'none'
    if (PROJECT_ROUTE_NAMES.has(toName) && !PROJECT_ROUTE_NAMES.has(fromName) && toSlug) {
      type = MORPH_SLUGS.has(toSlug) ? 'project-open-morph' : 'project-open-panel'
    } else if (PROJECT_ROUTE_NAMES.has(fromName) && !PROJECT_ROUTE_NAMES.has(toName) && fromSlug) {
      type = MORPH_SLUGS.has(fromSlug) ? 'project-close-morph' : 'project-close-panel'
    } else if (SECTION_ROUTE_NAMES.has(toName) && SECTION_ROUTE_NAMES.has(fromName) && toName !== fromName) {
      type = 'curtain'
    }

    morphTargetSlug.value = type === 'project-open-morph' ? toSlug! : type === 'project-close-morph' ? fromSlug! : null
    pageTransitionType.value = type
    // Both refs above drive :style bindings on already-MOUNTED elements
    // (the currently-visible listing card, or the currently-visible
    // project page's cover/content-pane) for the transition's "old"
    // side. Vue's reactivity normally flushes that DOM patch on a
    // microtask, not synchronously--awaiting nextTick() here guarantees
    // it's actually landed before we return control to Nuxt's own
    // beforeResolve guard (registered separately, always runs AFTER
    // every beforeEach guard per Vue Router's own ordering), which is
    // what calls document.startViewTransition() and takes the "old"
    // snapshot. The "new" side needs no such wait--it's a fresh mount
    // that simply reads whatever these refs hold at that later point.
    await nextTick()
    html.dataset.transition = type
  })
})
