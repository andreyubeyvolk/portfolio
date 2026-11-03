<script setup lang="ts">
// The interactive photo album (public/albums/<slug>/index.html, ?embed=1) as a
// gallery slot: an <iframe> over a still poster. The poster is what shows
// while the album loads and what stays if it never does (offline, blocked
// script, very old browser); the iframe fades in over it once the album
// reports "ready". Same origin, so the two can talk through postMessage.
//
// Wheel events over a cross-document iframe never reach this page's own
// listeners, which on desktop would break ScrollPane's Lenis smooth scroll
// whenever the pointer rests on the album. The album therefore forwards its
// wheel deltas and they are replayed here onto the scroll pane (desktop) or
// the window (mobile layout, where the document itself scrolls).
const props = defineProps<{
  src: string
  poster?: string
  title?: string
}>()

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const ready = ref(false)

function onMessage(e: MessageEvent) {
  const f = frame.value
  if (!f || e.source !== f.contentWindow || e.origin !== window.location.origin) return
  const d = e.data
  if (!d || d.source !== 'moleskine-album') return
  if (d.type === 'ready') {
    ready.value = true
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

onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <div class="album-embed" :class="{ 'is-ready': ready }">
    <img v-if="poster" class="album-embed__poster" :src="poster" :alt="title || ''" width="2160" height="1440" loading="lazy" />
    <iframe ref="frame" class="album-embed__frame" :src="src" :title="title || 'Interactive photo album'" loading="lazy" />
  </div>
</template>
