<script setup lang="ts">
// The interactive photo album (public/albums/<slug>/) as a gallery slot: an
// <iframe> over a still poster. Two versions of the album exist:
//   - 3D  (`src`)      the real book: covers, thickness, page turns, stickers.
//                      Desktop with a mouse, a decent GPU and motion allowed.
//   - flat (`flatSrc`)  pre-rendered pictures of the closed album and of every
//                      spread, no 3D, no filters. Phones, tablets, narrow
//                      windows, reduced motion, and any device where the 3D
//                      version reports that it runs below ~20 fps.
// `?mode=3d` or `?mode=flat` on THIS page's URL forces one (for testing).
//
// The poster is what shows while the album loads and what stays if it never
// does (offline, blocked script, very old browser); the iframe fades in over
// it once the album reports "ready". Same origin, so the two can talk through
// postMessage.
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

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const ready = ref(false)
// Decided on the client only (the iframe is not in the prerendered HTML), so
// nothing is loaded twice and the static page stays identical for everyone.
const mode = ref<'3d' | 'flat' | null>(null)
let forced = false

const frameSrc = computed(() => {
  if (mode.value === 'flat') return props.flatSrc || props.src
  return mode.value === '3d' ? props.src : ''
})

function pickMode(): '3d' | 'flat' {
  const forcedMode = new URLSearchParams(window.location.search).get('mode')
  if (forcedMode === 'flat' || forcedMode === '3d') {
    forced = true
    return forcedMode
  }
  if (!props.flatSrc) return '3d'
  const lite = window.matchMedia('(pointer: coarse), (max-width: 820px), (prefers-reduced-motion: reduce)').matches
  return lite ? 'flat' : '3d'
}

function onMessage(e: MessageEvent) {
  const f = frame.value
  if (!f || e.source !== f.contentWindow || e.origin !== window.location.origin) return
  const d = e.data
  if (!d || d.source !== 'moleskine-album') return
  if (d.type === 'ready') {
    ready.value = true
  }
  else if (d.type === 'slow') {
    // The 3D book runs too slowly here: swap to the flat version for good.
    if (mode.value === '3d' && props.flatSrc && !forced) {
      ready.value = false
      mode.value = 'flat'
    }
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

onMounted(() => {
  mode.value = pickMode()
  window.addEventListener('message', onMessage)
})
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <div class="album-embed" :class="{ 'is-ready': ready }">
    <img v-if="poster" class="album-embed__poster" :src="poster" :alt="title || ''" width="2160" height="1440" loading="lazy" />
    <iframe v-if="frameSrc" ref="frame" class="album-embed__frame" :src="frameSrc" :title="title || 'Interactive photo album'" loading="lazy" />
  </div>
</template>
