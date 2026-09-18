<script setup lang="ts">
// Custom scrollbar + wheel-scrolls-from-anywhere + Lenis smooth scroll
// (desktop only), ported from scroll.js. The math/thresholds below are
// copied verbatim from that file—only the wiring changed.
//
// Why this couldn't just be the original file loaded as a global script
// (unlike menu.js/logo-scrub.js in plugins/legacy-nav-scripts.client.ts):
// scroll.js assumed a single full page load, so it never needed to tear
// itself down. Here, a different page's ScrollPane mounts and unmounts on
// every client-side navigation, so without explicit cleanup each
// navigation would leave behind an orphaned Lenis instance, wheel
// listener, and scrollbar track—all still running against a pane that no
// longer exists.
interface LenisInstance {
  destroy: () => void
  scrollTo: (target: number, opts?: Record<string, unknown>) => void
}

declare global {
  interface Window {
    Lenis?: new (opts: Record<string, unknown>) => LenisInstance
  }
  interface HTMLElement {
    lenisInstance?: LenisInstance
  }
}

const props = defineProps<{
  // to-top.js's original query is document.querySelector('.project-scroll')
  // (project pages only)—About's pane doesn't need this class at all.
  projectScroll?: boolean
}>()

const paneRef = useTemplateRef<HTMLElement>('pane')
let track: HTMLDivElement | null = null
let thumb: HTMLDivElement | null = null
let lenis: LenisInstance | null = null
let resizeObserver: ResizeObserver | null = null
let isDragging = false
let dragStartY = 0
let dragStartScrollTop = 0
let mq: MediaQueryList | null = null

function getMetrics(pane: HTMLElement, host: HTMLElement) {
  const paneRect = pane.getBoundingClientRect()
  const hostRect = host.getBoundingClientRect()
  const scrollHeight = pane.scrollHeight
  const clientHeight = pane.clientHeight
  const maxScrollTop = Math.max(scrollHeight - clientHeight, 0)
  const trackHeight = paneRect.height
  const thumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 48)
  const maxThumbTop = Math.max(trackHeight - thumbHeight, 0)

  return {
    top: paneRect.top - hostRect.top,
    height: trackHeight,
    thumbHeight,
    maxThumbTop,
    maxScrollTop,
  }
}

function update() {
  const pane = paneRef.value
  const host = pane?.parentElement
  if (!pane || !host || !track || !thumb) return
  const metrics = getMetrics(pane, host)

  track.hidden = metrics.maxScrollTop <= 1 || metrics.height <= 0
  track.style.top = `${metrics.top}px`
  track.style.height = `${metrics.height}px`

  if (track.hidden) return

  const scrollRatio = pane.scrollTop / metrics.maxScrollTop
  const thumbTop = scrollRatio * metrics.maxThumbTop

  thumb.style.height = `${metrics.thumbHeight}px`
  thumb.style.transform = `translateY(${thumbTop}px)`
}

function scrollToPointer(clientY: number) {
  const pane = paneRef.value
  const host = pane?.parentElement
  if (!pane || !host || !track) return
  const metrics = getMetrics(pane, host)
  const trackRect = track.getBoundingClientRect()
  const targetThumbTop = clientY - trackRect.top - metrics.thumbHeight / 2
  const clampedThumbTop = Math.max(0, Math.min(targetThumbTop, metrics.maxThumbTop))
  const ratio = metrics.maxThumbTop > 0 ? clampedThumbTop / metrics.maxThumbTop : 0

  pane.scrollTop = ratio * metrics.maxScrollTop
}

function onTrackPointerDown(event: PointerEvent) {
  if (event.target === thumb) return
  scrollToPointer(event.clientY)
}

function onThumbPointerDown(event: PointerEvent) {
  event.preventDefault()
  isDragging = true
  dragStartY = event.clientY
  dragStartScrollTop = paneRef.value?.scrollTop ?? 0
  thumb?.setPointerCapture(event.pointerId)
}

function onThumbPointerMove(event: PointerEvent) {
  if (!isDragging || !paneRef.value) return
  const host = paneRef.value.parentElement
  if (!host) return
  const metrics = getMetrics(paneRef.value, host)
  const dragDelta = event.clientY - dragStartY
  const scrollRatio = metrics.maxThumbTop > 0 ? dragDelta / metrics.maxThumbTop : 0

  paneRef.value.scrollTop = dragStartScrollTop + scrollRatio * metrics.maxScrollTop
}

function onThumbPointerUp(event: PointerEvent) {
  isDragging = false
  thumb?.releasePointerCapture(event.pointerId)
}

function onWheel(event: WheelEvent) {
  const pane = paneRef.value
  if (!pane || !mq?.matches) return
  if (document.body.classList.contains('is-preview-open')) return
  if (pane.contains(event.target as Node)) return
  if (pane.scrollHeight <= pane.clientHeight) return

  if (lenis) {
    pane.dispatchEvent(new WheelEvent('wheel', event))
  } else {
    pane.scrollTop += event.deltaY
  }
  event.preventDefault()
}

onMounted(() => {
  const pane = paneRef.value
  const host = pane?.parentElement
  if (!pane || !host) return

  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative'
  }

  track = document.createElement('div')
  thumb = document.createElement('div')
  track.className = 'custom-scrollbar'
  thumb.className = 'custom-scrollbar__thumb'
  track.appendChild(thumb)
  host.appendChild(track)

  pane.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)

  resizeObserver = new ResizeObserver(update)
  resizeObserver.observe(pane)
  resizeObserver.observe(host)

  track.addEventListener('pointerdown', onTrackPointerDown)
  thumb.addEventListener('pointerdown', onThumbPointerDown)
  thumb.addEventListener('pointermove', onThumbPointerMove)
  thumb.addEventListener('pointerup', onThumbPointerUp)

  mq = window.matchMedia('(min-width: 981px)')
  if (mq.matches && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({ wrapper: pane, content: pane.firstElementChild, autoRaf: true })
    // Exposed on the element (not a Vue provide/inject) so KvIcon.vue's
    // "to top" can pause/resume this exact instance via a plain
    // closest('.project-scroll') query—matches how scroll.js itself did
    // it, no extra wiring needed between components that don't otherwise
    // know about each other.
    pane.lenisInstance = lenis
  }
  window.addEventListener('wheel', onWheel, { passive: false })

  update()
})

onBeforeUnmount(() => {
  lenis?.destroy()
  lenis = null
  window.removeEventListener('wheel', onWheel)
  window.removeEventListener('resize', update)
  resizeObserver?.disconnect()
  track?.remove()
})
</script>

<template>
  <div ref="pane" class="content-pane__scroll custom-scroll" :class="{ 'project-scroll': projectScroll }">
    <slot />
  </div>
</template>
