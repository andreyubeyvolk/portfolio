// Classifies every client-side route change so page-transitions.css
// knows which View Transition effect to play (see that file's own
// header). Runs in a router.beforeEach guard--before Vue Router
// resolves the new route/swaps components--so by the time Nuxt's own
// viewTransition wiring calls document.startViewTransition() a moment
// later, documentElement.dataset.transition already reflects this
// navigation's target, and stays that way (on <html>, untouched by the
// page swap itself) for the CSS to read once both snapshots exist.
const SECTION_ROUTE_NAMES = new Set(['inhouse', 'brands', 'archive', 'about'])
const PROJECT_ROUTE_NAMES = new Set(['inhouse-slug', 'brands-slug'])

// Cover-morph test scope--"попробуем морфинг, например айгейминге
// сначала": only iGaming carries a matching view-transition-name today
// (see ProjectCard.vue/ProjectPage.vue), so only its own open/close
// gets classified as project-open/-close. Every other project falls
// through to 'none'--the browser's plain default cross-fade, not the
// curtain (a project page isn't a "section" nav).
const MORPH_SLUGS = new Set(['igaming'])

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  router.beforeEach((to, from) => {
    const html = document.documentElement
    const toName = String(to.name ?? '')
    const fromName = String(from.name ?? '')
    const toSlug = typeof to.params.slug === 'string' ? to.params.slug : undefined
    const fromSlug = typeof from.params.slug === 'string' ? from.params.slug : undefined

    let type = 'none'
    if (PROJECT_ROUTE_NAMES.has(toName) && !PROJECT_ROUTE_NAMES.has(fromName) && toSlug && MORPH_SLUGS.has(toSlug)) {
      type = 'project-open'
    } else if (PROJECT_ROUTE_NAMES.has(fromName) && !PROJECT_ROUTE_NAMES.has(toName) && fromSlug && MORPH_SLUGS.has(fromSlug)) {
      type = 'project-close'
    } else if (SECTION_ROUTE_NAMES.has(toName) && SECTION_ROUTE_NAMES.has(fromName) && toName !== fromName) {
      type = 'curtain'
    }
    html.dataset.transition = type
  })
})
