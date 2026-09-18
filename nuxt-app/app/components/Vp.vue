<script setup lang="ts">
// Full custom video player—play/pause, mute + volume, seek, auto-hide
// controls, keyboard support. Ported from video-player.js's initPlayer,
// restructured around refs/reactive state instead of querySelector +
// direct DOM writes, with onBeforeUnmount cleanup for the timers/observer
// (the original never needed that: one page load, one player, torn down
// for free by full navigation—an SPA reuses the same page instance
// across client-side navigations, so this needs to clean up after itself).
//
// Note: the responsive data-src-portrait/data-src-landscape source switch
// from the original script isn't ported—no current project uses it. Add
// it back here if one ever does.
const props = defineProps<{
  src: string
  paired?: boolean
  autoplay?: 'immediate' | 'scroll'
}>()

const vpRef = useTemplateRef<HTMLElement>('vp')
const videoRef = useTemplateRef<HTMLVideoElement>('video')
const seekRef = useTemplateRef<HTMLElement>('seek')
const volumeRef = useTemplateRef<HTMLElement>('volume')

const state = ref<'playing' | 'paused'>('paused')
const muted = ref(true)
const isIdle = ref(false)
const seekPercent = ref(0)
const volumePercent = ref(70)
const isDraggingSeek = ref(false)
const isDraggingVolume = ref(false)

let lastVolume = 0.7
let hideTimer: ReturnType<typeof setTimeout> | undefined
let intersectionObserver: IntersectionObserver | null = null
const HIDE_DELAY = 2500

function toggle() {
  const video = videoRef.value
  if (!video) return
  if (video.paused) video.play().catch(() => {})
  else video.pause()
}

function onHit() {
  if (isIdle.value) showControls()
  else toggle()
}

function showControls() {
  isIdle.value = false
  clearTimeout(hideTimer)
  if (videoRef.value && !videoRef.value.paused) hideTimer = setTimeout(hideControls, HIDE_DELAY)
}
function hideControls() {
  if (videoRef.value && !videoRef.value.paused) isIdle.value = true
}

function onMute() {
  const video = videoRef.value
  if (!video) return
  video.muted = !video.muted
  if (!video.muted && video.volume === 0) video.volume = lastVolume || 0.7
  syncVolumeUi()
}

function syncVolumeUi() {
  const video = videoRef.value
  if (!video) return
  const level = video.muted ? 0 : video.volume
  volumePercent.value = level * 100
  muted.value = video.muted
}

function ratioFromEvent(el: HTMLElement, e: PointerEvent, vertical: boolean) {
  const r = el.getBoundingClientRect()
  let v: number
  if (vertical) v = 1 - (e.clientY - r.top) / r.height
  else v = (e.clientX - r.left) / r.width
  return Math.min(1, Math.max(0, v))
}

function makeDraggable(
  elRef: typeof seekRef,
  vertical: boolean,
  draggingFlag: typeof isDraggingSeek,
  onChange: (ratio: number) => void,
) {
  function move(e: PointerEvent) {
    const el = elRef.value
    if (!el) return
    onChange(ratioFromEvent(el, e, vertical))
  }
  function onPointerDown(e: PointerEvent) {
    draggingFlag.value = true
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch {}
    move(e)
  }
  function onPointerMove(e: PointerEvent) {
    if (draggingFlag.value) move(e)
  }
  function onPointerUp() {
    draggingFlag.value = false
  }
  return { onPointerDown, onPointerMove, onPointerUp }
}

const seekDrag = makeDraggable(seekRef, false, isDraggingSeek, (ratio) => {
  const video = videoRef.value
  if (video?.duration) video.currentTime = ratio * video.duration
})

const volumeDrag = makeDraggable(volumeRef, true, isDraggingVolume, (ratio) => {
  const video = videoRef.value
  if (!video) return
  video.volume = ratio
  lastVolume = ratio || lastVolume
  video.muted = ratio === 0
  syncVolumeUi()
})

function onSeekKeydown(e: KeyboardEvent) {
  const video = videoRef.value
  if (!video) return
  const step = 0.05
  const cur = video.duration ? video.currentTime / video.duration : 0
  if (e.key === 'ArrowRight') { video.currentTime = Math.min(1, cur + step) * video.duration; e.preventDefault() }
  if (e.key === 'ArrowLeft') { video.currentTime = Math.max(0, cur - step) * video.duration; e.preventDefault() }
}

function onVolumeKeydown(e: KeyboardEvent) {
  const video = videoRef.value
  if (!video) return
  const step = 0.05
  const cur = video.muted ? 0 : video.volume
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
    video.volume = Math.min(1, cur + step); video.muted = false; lastVolume = video.volume; syncVolumeUi(); e.preventDefault()
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
    video.volume = Math.max(0, cur - step); video.muted = video.volume === 0; syncVolumeUi(); e.preventDefault()
  }
}

function onTimeUpdate() {
  const video = videoRef.value
  if (!video?.duration) return
  seekPercent.value = (video.currentTime / video.duration) * 100
}

onMounted(() => {
  const video = videoRef.value
  const vp = vpRef.value
  if (!video || !vp) return

  video.muted = true
  video.volume = lastVolume
  syncVolumeUi()

  video.addEventListener('play', () => { state.value = 'playing'; hideTimer = setTimeout(hideControls, HIDE_DELAY) })
  video.addEventListener('pause', () => { state.value = 'paused'; clearTimeout(hideTimer); isIdle.value = false })
  video.addEventListener('timeupdate', onTimeUpdate)

  vp.addEventListener('mousemove', showControls)
  vp.addEventListener('mouseenter', showControls)
  vp.addEventListener('mouseleave', hideControls)

  const autoplayMode = props.autoplay || 'immediate'
  if (autoplayMode === 'scroll' && 'IntersectionObserver' in window) {
    intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        isIdle.value = true
        video.play().catch(() => { isIdle.value = false })
        intersectionObserver?.disconnect()
      }
    }, { threshold: 0.5 })
    intersectionObserver.observe(vp)
  } else {
    isIdle.value = true
    video.play().catch(() => { isIdle.value = false })
  }
})

onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  intersectionObserver?.disconnect()
})
</script>

<template>
  <div
    ref="vp"
    class="vp"
    :class="{ 'vp--paired': paired, 'is-idle': isIdle }"
    :data-state="state"
    :data-muted="muted ? 'true' : 'false'"
  >
    <video ref="video" class="vp__video" playsinline muted loop preload="metadata" :src="src" />

    <div class="vp__hit" data-role="toggle" @click="onHit" />

    <button class="vp__big" type="button" aria-label="Play" @click="toggle">
      <svg viewBox="0 0 45 54" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M0 0L45 27L0 54V0Z" fill="currentColor" />
      </svg>
    </button>

    <button class="vp__mute" type="button" aria-label="Toggle sound" @click="onMute">
      <svg class="icon-on" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 9V15H8L13 19V5L8 9H4Z" fill="currentColor" />
        <path d="M16 9C16.8 9.8 16.8 14.2 16 15M18.5 6.5C20.5 8.5 20.5 15.5 18.5 17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <svg class="icon-off" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 9V15H8L13 19V5L8 9H4Z" fill="currentColor" />
        <path d="M17 10L21 14M21 10L17 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>

    <div
      ref="volume"
      class="vp-slider vp-slider--y"
      :class="{ 'is-dragging': isDraggingVolume }"
      data-role="volume"
      role="slider"
      aria-label="Volume"
      aria-orientation="vertical"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(volumePercent)"
      tabindex="0"
      @pointerdown="volumeDrag.onPointerDown"
      @pointermove="volumeDrag.onPointerMove"
      @pointerup="volumeDrag.onPointerUp"
      @pointercancel="volumeDrag.onPointerUp"
      @keydown="onVolumeKeydown"
    >
      <div class="vp-slider__track" />
      <div class="vp-slider__fill" :style="{ height: volumePercent + '%' }" />
      <div class="vp-slider__head" :style="{ bottom: volumePercent + '%' }" />
    </div>

    <button class="vp__play" type="button" aria-label="Play" @click="toggle">
      <svg class="icon-play" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 2L20 11L4 20V2Z" fill="currentColor" />
      </svg>
      <svg class="icon-pause" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4" y="2" width="5" height="18" fill="currentColor" />
        <rect x="13" y="2" width="5" height="18" fill="currentColor" />
      </svg>
    </button>

    <div
      ref="seek"
      class="vp-slider vp-slider--x"
      :class="{ 'is-dragging': isDraggingSeek }"
      data-role="seek"
      role="slider"
      aria-label="Seek"
      aria-orientation="horizontal"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(seekPercent)"
      tabindex="0"
      @pointerdown="seekDrag.onPointerDown"
      @pointermove="seekDrag.onPointerMove"
      @pointerup="seekDrag.onPointerUp"
      @pointercancel="seekDrag.onPointerUp"
      @keydown="onSeekKeydown"
    >
      <div class="vp-slider__track" />
      <div class="vp-slider__fill" :style="{ width: seekPercent + '%' }" />
      <div class="vp-slider__head" :style="{ left: seekPercent + '%' }" />
    </div>
  </div>
</template>
