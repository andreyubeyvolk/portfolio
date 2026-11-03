<script setup lang="ts">
// The interactive photo album (public/albums/<slug>/) as a gallery slot: an
// <iframe> over a still poster. Two versions of the album exist:
//   - 3D  (`src`)      the real book: covers, thickness, page turns, stickers.
//                      Desktop with a mouse, a decent GPU and a decent connection.
//   - flat (`flatSrc`)  pre-rendered pictures of the closed album, of every
//                      spread and of the back cover, no 3D, no filters. Phones,
//                      tablets, narrow windows, reduced motion, data saver / 2G-3G,
//                      little memory, and any device where the 3D version reports
//                      that it runs below ~18 fps or gets stuck.
// `?mode=3d` or `?mode=flat` on THIS page's URL forces one (for testing; no
// automatic fallback then).
//
// The poster is what shows while the album loads and what stays if it never
// does (offline, blocked script, very old browser); the iframe fades in over
// it once the album reports "ready" (its cover is really loaded and decoded).
// Same origin, so the two can talk through postMessage.
//
// Nothing may leave the visitor with a dead block, so there is a fallback chain:
//   3D --(no "ready" in 25 s | "error" | "slow" | stuck)--> flat
//   flat --(no "ready" in 25 s | "error")--> poster only, retried when the
//   browser comes back online and twice more after 20 s.
//
// Only the layout that is actually visible gets an iframe (both layouts are in
// the DOM, one of them display:none), and the mode is decided on the client
// only (the iframe is not in the prerendered HTML), so nothing is loaded twice
// and the static page stays identical for everyone.
//
// Wheel events over a cross-document iframe never reach this page's own
// listeners, which on desktop would break ScrollPane's Lenis smooth scroll
// whenever the pointer rests on the album. The album therefore forwards its
// wheel deltas and they are replayed here onto the scroll pane (desktop) or
// the window (mobile layout, where the document itself scrolls).
const props = defineProps<{
  src: string
  flatSrc?: string
  poster?: string
  title?: string
}>()

type Mode = '3d' | 'flat' | 'none'

const READY_TIMEOUT = 25000
const RETRY_DELAY = 20000
const MAX_RETRIES = 2

const root = useTemplateRef<HTMLElement>('root')
const frame = useTemplateRef<HTMLIFrameElement>('frame')
const ready = ref(false)
// null = not decided yet (not mounted, or this instance is the hidden layout)
const mode = ref<Mode | null>(null)
let forced = false
let seen = false
let retries = 0
let watchdog: ReturnType<typeof setTimeout> | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined

const frameSrc = computed(() => {
  if (mode.value === 'flat') return props.flatSrc || props.src
  return mode.value === '3d' ? props.src : ''
})

function pickMode(): Mode {
  const forcedMode = new URLSearchParams(window.location.search).get('mode')
  if (forcedMode === 'flat' || forcedMode === '3d') {
    forced = true
    return forcedMode
  }
  if (!props.flatSrc) return '3d'
  // Data saver, 2G, or a measured downlink under 1 Mbit/s. effectiveType "3g" alone is not enough: Chrome also says 3g on a fast desktop connection with a high round trip (VPN).
  const nav = navigator as Navigator & { connection?: { saveData?: boolean, effectiveType?: string, downlink?: number }, deviceMemory?: number }
  const conn = nav.connection
  const slowNetwork = !!conn && (!!conn.saveData || /^(slow-2g|2g)$/.test(conn.effectiveType || '') || (typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < 1))
  const littleMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2
  const lite = window.matchMedia('(pointer: coarse), (max-width: 820px), (prefers-reduced-motion: reduce)').matches
  return lite || slowNetwork || littleMemory ? 'flat' : '3d'
}

function decide() {
  if (mode.value !== null) return
  const box = root.value
  // the other layout is display:none: it must not load an album nobody sees
  if (box && (box.offsetWidth === 0 || box.offsetHeight === 0)) return
  mode.value = pickMode()
  resizeObserver?.disconnect()
}

function armWatchdog() {
  clearTimeout(watchdog)
  if (ready.value || !mode.value || mode.value === 'none') return
  watchdog = setTimeout(() => fallBack(), READY_TIMEOUT)
}

function fallBack() {
  clearTimeout(watchdog)
  if (forced || ready.value) return
  if (mode.value === '3d' && props.flatSrc) {
    mode.value = 'flat'
    armWatchdog()
  }
  else if (mode.value === '3d' || mode.value === 'flat') {
    mode.value = 'none'
    scheduleRetry()
  }
}

function scheduleRetry() {
  clearTimeout(retryTimer)
  if (retries >= MAX_RETRIES) return
  retryTimer = setTimeout(retry, RETRY_DELAY)
}

function retry() {
  if (mode.value !== 'none') return
  retries++
  ready.value = false
  mode.value = props.flatSrc ? 'flat' : '3d'
  armWatchdog()
}

function onOnline() {
  if (mode.value === 'none') retry()
}

function onMessage(e: MessageEvent) {
  const f = frame.value
  if (!f || e.source !== f.contentWindow || e.origin !== window.location.origin) return
  const d = e.data
  if (!d || d.source !== 'moleskine-album') return
  if (d.type === 'ready') {
    ready.value = true
    clearTimeout(watchdog)
  }
  else if (d.type === 'slow') {
    // The 3D book runs too slowly here (or got stuck): swap to the flat version.
    if (mode.value === '3d' && props.flatSrc) fallBack()
  }
  else if (d.type === 'error') {
    // The album could not load its own data (config, cover pictures).
    fallBack()
  }
  else if (d.type === 'wheel') {
    const pane = f.closest('.content-pane__scroll') as HTMLElement | null
    if (pane && window.matchMedia('(min-width: 981px)').matches) {
      pane.dispatchEvent(new WheelEvent('wheel', { deltaX: d.dx, deltaY: d.dy, deltaMode: d.mode, bubbles: true, cancelable: true }))
    }
    else {
      window.scrollBy(d.dx * (d.mode === 1 ? 33 : 1), d.dy * (d.mode === 1 ? 33 : 1))
    }
  }
}

watch(mode, () => {
  if (seen) armWatchdog()
})

onMounted(() => {
  window.addEventListener('message', onMessage)
  window.addEventListener('online', onOnline)
  const box = root.value
  if (box && typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(decide)
    resizeObserver.observe(box)
  }
  decide()
  if (box && typeof IntersectionObserver === 'function') {
    intersectionObserver = new IntersectionObserver((entries) => {
      if (!entries.some(en => en.isIntersecting)) return
      seen = true
      armWatchdog()
      intersectionObserver?.disconnect()
    })
    intersectionObserver.observe(box)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  window.removeEventListener('online', onOnline)
  clearTimeout(watchdog)
  clearTimeout(retryTimer)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
})
</script>

<template>
  <div ref="root" class="album-embed" :class="{ 'is-ready': ready }">
    <img v-if="poster" class="album-embed__poster" :src="poster" :alt="title || ''" width="2160" height="1440" loading="lazy" />
    <iframe
      v-if="frameSrc"
      :key="mode || ''"
      ref="frame"
      class="album-embed__frame"
      :src="frameSrc"
      :title="title || 'Interactive photo album'"
      loading="lazy"
      @load="armWatchdog"
    />
  </div>
</template>
