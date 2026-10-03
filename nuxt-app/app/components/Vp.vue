<script setup lang="ts">
// Full custom video player—play/pause, mute + volume, seek, auto-hide
// controls, keyboard support. Ported from video-player.js's initPlayer,
// restructured around refs/reactive state instead of querySelector +
// direct DOM writes, with onBeforeUnmount cleanup for the timers/observer
// (the original never needed that: one page load, one player, torn down
// for free by full navigation—an SPA reuses the same page instance
// across client-side navigations, so this needs to clean up after itself).
//
// srcMobile/posterMobile bring back the original script's responsive
// data-src-portrait/data-src-landscape source switch (dropped during the
// migration since nothing used it yet—the home reel is the first case
// that does). The <source media> swap itself is native/CSS-only (see the
// template), so it's correct even before hydration; only the poster needs
// a tiny bit of JS since <video poster> can't vary by media query on its
// own.
const props = withDefaults(defineProps<{
  src: string
  srcMobile?: string
  paired?: boolean
  autoplay?: 'immediate' | 'scroll'
  poster?: string
  posterMobile?: string
  // Volume the player unmutes to (it always starts muted).
  volume?: number
  // 'hover' (project galleries): controls appear on pointer movement.
  // 'click' (home reel): controls stay hidden until the video itself is
  // clicked/tapped--moving the pointer over it only keeps already-shown
  // controls alive, so they don't vanish mid-drag on the sliders.
  revealOn?: 'hover' | 'click'
}>(), { volume: 0.7, revealOn: 'hover' })

// Only read once on mount--matches the <source media> swap above, which
// also only resolves at load time, not live across a resize.
const isMobileViewport = ref(false)
onMounted(() => {
  isMobileViewport.value = window.matchMedia('(max-width: 640px)').matches
})
const effectivePoster = computed(() => {
  if (isMobileViewport.value && props.posterMobile) return props.posterMobile
  return props.poster ?? videoPoster(props.src)
})
// Native fallback for 'immediate' reels: if this component's own JS is
// slow to hydrate (or fails outright--a script error elsewhere, a
// blocker), the browser can still start playback on its own once enough
// data is buffered, same as the <source media> swap already works without
// JS. Redundant with playWhenReady() below once JS does run (calling
// play() on an already-playing video is a harmless no-op), so this is
// pure downside-free insurance, not a behavior change. Left off entirely
// for 'scroll' reels, which must stay paused until actually scrolled into
// view.
const isImmediateAutoplay = computed(() => (props.autoplay || 'immediate') !== 'scroll')

const vpRef = useTemplateRef<HTMLElement>('vp')
const videoRef = useTemplateRef<HTMLVideoElement>('video')
const seekRef = useTemplateRef<HTMLElement>('seek')
const volumeRef = useTemplateRef<HTMLElement>('volume')

const state = ref<'playing' | 'paused'>('paused')
const muted = ref(true)
const isIdle = ref(false)
const seekPercent = ref(0)
// How far ahead of playback the browser has actually downloaded--the
// semi-transparent bar running ahead of the white played-progress line, so
// a stall on a slow connection reads as "still loading" instead of just
// silently freezing.
const bufferedPercent = ref(0)
const volumePercent = ref(props.volume * 100)
const isDraggingSeek = ref(false)
const isDraggingVolume = ref(false)

let lastVolume = props.volume
let hideTimer: ReturnType<typeof setTimeout> | undefined
let intersectionObserver: IntersectionObserver | null = null
const HIDE_DELAY = 2500

// Whether this player is *supposed* to be autoplaying right now--true from
// mount for 'immediate', flipped true once the scroll-triggered play
// actually fires for 'scroll' (set in the onMounted below). Cleared the
// moment a human calls toggle() themselves, so the visibility-driven
// resume further down never fights a deliberate pause.
let autoplayIntent = false

// Ctrl/Cmd is graffiti.js's own "paint mode" modifier (see that file's
// onMouseDown)--a tag drawn across the reel shouldn't also toggle
// play/pause, seek, or change volume underneath it. graffiti.js already
// calls preventDefault() on these events for its own reasons, but that
// only cancels the browser's default action (e.g. a link navigating), not
// other elements' click/pointerdown handlers--this component needs its
// own guard against the same modifier.
function isPaintClick(e?: { ctrlKey: boolean; metaKey: boolean }) {
  return !!e && (e.ctrlKey || e.metaKey)
}

function toggle(e?: MouseEvent) {
  if (isPaintClick(e)) return
  autoplayIntent = false
  const video = videoRef.value
  if (!video) return
  if (video.paused) video.play().catch(() => {})
  else video.pause()
}

function onHit(e: MouseEvent) {
  if (isPaintClick(e)) return
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
// Click-reveal (home reel): once the pointer leaves a paused player, fade
// everything out after the usual delay so only the still frame remains;
// coming back before it fires cancels it via showControls().
function onLeave() {
  clearTimeout(hideTimer)
  if (props.revealOn === 'click' && videoRef.value?.paused) {
    hideTimer = setTimeout(() => { isIdle.value = true }, HIDE_DELAY)
  } else {
    hideControls()
  }
}

function onMute(e?: MouseEvent) {
  if (isPaintClick(e)) return
  const video = videoRef.value
  if (!video) return
  video.muted = !video.muted
  if (!video.muted && video.volume === 0) video.volume = lastVolume || props.volume
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
    if (isPaintClick(e)) return
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

function onBufferedProgress() {
  const video = videoRef.value
  if (!video?.duration) return
  // buffered is a set of disjoint ranges (a seek can leave a gap behind
  // it)--the one that matters for "how far ahead can it play without
  // stalling" is whichever range actually contains the current position.
  const ranges = video.buffered
  let end = 0
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= video.currentTime && video.currentTime <= ranges.end(i)) {
      end = ranges.end(i)
      break
    }
  }
  bufferedPercent.value = (end / video.duration) * 100
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
  // 'progress' fires repeatedly while data downloads; 'timeupdate' also
  // catches the case where buffered range membership changes just from
  // playback advancing into/out of a range without new data arriving.
  video.addEventListener('progress', onBufferedProgress)
  video.addEventListener('timeupdate', onBufferedProgress)

  if (props.revealOn === 'click') {
    vp.addEventListener('mousemove', () => { if (!isIdle.value) showControls() })
  } else {
    vp.addEventListener('mousemove', showControls)
    vp.addEventListener('mouseenter', showControls)
  }
  vp.addEventListener('mouseleave', onLeave)

  // With srcMobile, the template renders <source> children instead of the
  // old plain :src binding so the browser can pick between them by media
  // query. Per spec, a <video> only runs its resource-selection algorithm
  // once automatically; <source> children present when that already-
  // resolved element gets (re)created via DOM APIs--which is exactly what
  // Vue does when mounting/hydrating, as opposed to the browser's own HTML
  // parser encountering static markup--need an explicit load() to be
  // picked up at all. Without it the element just sits at
  // readyState 0/HAVE_NOTHING forever, and play() rejects with nothing to
  // retry it, so autoplay silently never starts. Harmless for the plain
  // single-<source> case too (there's nothing buffered yet to lose).
  if (props.srcMobile) video.load()

  function playWhenReady() {
    if (video.readyState >= 2) {
      video.play().catch(() => { isIdle.value = false })
    } else {
      video.addEventListener('loadeddata', () => {
        video.play().catch(() => { isIdle.value = false })
      }, { once: true })
    }
  }

  const autoplayMode = props.autoplay || 'immediate'
  autoplayIntent = autoplayMode !== 'scroll'
  if (autoplayMode === 'scroll' && 'IntersectionObserver' in window) {
    intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        isIdle.value = true
        autoplayIntent = true
        playWhenReady()
        intersectionObserver?.disconnect()
      }
    }, { threshold: 0.5 })
    intersectionObserver.observe(vp)
  } else {
    isIdle.value = true
    playWhenReady()
  }

  // srcMobile only: a <source media> swap doesn't re-run on its own when
  // the viewport crosses the breakpoint after load (only a fresh load()
  // re-evaluates it)--so resizing a desktop window down past 640px, or
  // rotating a tablet, silently left the *old* aspect's video playing
  // inside the *new* breakpoint's differently-shaped crop box (confirmed:
  // the wrong video, stretched/cropped hard by object-fit:cover). Reload
  // to the correct source--and its matching poster--whenever the
  // breakpoint actually changes; only resume playback immediately if it
  // was already playing (or isn't scroll-gated), so a 'scroll' reel that
  // hasn't been triggered yet just gets primed with the right source for
  // whenever it eventually scrolls into view.
  let mobileQuery: MediaQueryList | null = null
  let onBreakpointChange: (() => void) | null = null
  if (props.srcMobile) {
    mobileQuery = window.matchMedia('(max-width: 640px)')
    onBreakpointChange = () => {
      isMobileViewport.value = mobileQuery!.matches
      const wasPlaying = !video.paused
      video.load()
      if (wasPlaying || autoplayMode !== 'scroll') playWhenReady()
    }
    mobileQuery.addEventListener('change', onBreakpointChange)
  }

  // Chrome (and others) can suspend an autoplaying video in a tab that's
  // hidden when playback starts--e.g. this page loaded in a background
  // tab--and does not resume it on its own once the tab becomes visible
  // again. Retry then, but only for a reel that's supposed to be
  // autoplaying and isn't paused for some other reason (a real buffering
  // stall still reports paused:false, so this won't fight that).
  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && autoplayIntent && video.paused) {
      video.play().catch(() => {})
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  onBeforeUnmount(() => {
    if (mobileQuery && onBreakpointChange) mobileQuery.removeEventListener('change', onBreakpointChange)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
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
    :class="{ 'vp--paired': paired, 'vp--click-reveal': revealOn === 'click', 'is-idle': isIdle }"
    :data-state="state"
    :data-muted="muted ? 'true' : 'false'"
  >
    <video ref="video" class="vp__video" playsinline muted loop preload="metadata" :autoplay="isImmediateAutoplay" :poster="effectivePoster">
      <source v-if="srcMobile" :src="srcMobile" media="(max-width: 640px)" />
      <source :src="src" />
    </video>

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
      <div class="vp-slider__buffered" :style="{ width: bufferedPercent + '%' }" />
      <div class="vp-slider__fill" :style="{ width: seekPercent + '%' }" />
      <div class="vp-slider__head" :style="{ left: seekPercent + '%' }" />
    </div>
  </div>
</template>
