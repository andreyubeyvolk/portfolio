// Ported from to-top.js's animateScrollTo/scrollToTop--shared by
// KvIcon.vue's "To top" button and the Archive page's own "To top"
// button (which replaces "Load more" once the grid is fully loaded).
// Parameterized by a CSS selector for the scrollable pane, since each
// caller's pane carries a different marker class (KvIcon's project
// pages use ScrollPane's `project-scroll` prop; Archive's pane doesn't
// need that prop at all--`.content-pane__scroll` alone is already
// unambiguous, since only one ScrollPane exists per page).
declare global {
  interface HTMLElement {
    lenisInstance?: { scrollTo: (target: number, opts?: Record<string, unknown>) => void }
  }
}

function easeOutQuint(t: number) { return 1 - Math.pow(1 - t, 5) }

function animateScrollTo(getPos: () => number, setPos: (v: number) => void, target: number, duration: number, onDone?: () => void) {
  const start = getPos()
  const change = target - start
  if (!change) { onDone?.(); return }
  let startTime: number | null = null
  function step(now: number) {
    if (startTime === null) startTime = now
    const t = Math.min((now - startTime) / duration, 1)
    setPos(start + change * easeOutQuint(t))
    if (t < 1) requestAnimationFrame(step)
    else onDone?.()
  }
  requestAnimationFrame(step)
}

export function useScrollToPane(selector: string) {
  let isAnimating = false
  function scrollTo(target: number, duration = 1400, onDone?: () => void) {
    if (isAnimating) return
    isAnimating = true
    const pane = document.querySelector<HTMLElement>(selector)
    const desktopQuery = window.matchMedia('(min-width: 981px)')
    const done = () => { isAnimating = false; onDone?.() }
    if (desktopQuery.matches && pane) {
      const setPos = pane.lenisInstance
        ? (v: number) => pane.lenisInstance!.scrollTo(v, { immediate: true })
        : (v: number) => { pane.scrollTop = v }
      animateScrollTo(() => pane.scrollTop, setPos, target, duration, done)
    } else {
      animateScrollTo(() => window.scrollY, (v) => window.scrollTo(0, v), target, duration, done)
    }
  }
  return { scrollTo }
}
