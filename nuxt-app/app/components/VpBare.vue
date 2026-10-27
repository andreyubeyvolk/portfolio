<script setup lang="ts">
// Silent, looping, autoplay-on-scroll video with zero player chrome.
// Ported from video-player.js's .vp-bare handling, then reworked after
// "black screen" reports on pages with many videos (Sumsub has ten):
//
//  - The poster is a real <img> UNDER the <video>, not the video's own
//    `poster` attribute. The video stays transparent (opacity 0) until it
//    has actually presented a frame, then fades in over the still--so the
//    gap between "poster cleared" and "first frame painted", where browsers
//    flash black, is never visible, and a video that loses its frame later
//    (see below) falls back to the still instead of a black rectangle.
//  - Only videos near the viewport hold a media resource at all. Every
//    <video> with a src keeps a decoder and big GPU frame buffers alive even
//    when paused; a long session of scrolling a page with ten 2160x1440
//    clips piles those up until the browser starts dropping them, which is
//    when the picture goes black for good. So: attach `src` within about
//    one screen of the viewport, play while mostly visible, pause + hide
//    when it leaves, and fully release (drop `src`, load()) once it is far.
//  - A watchdog restarts a video that is supposed to be playing but has
//    stopped presenting frames (a dead decoder), where the browser supports
//    requestVideoFrameCallback to tell.
const props = defineProps<{ src: string; width: number; height: number }>()

const videoRef = useTemplateRef<HTMLVideoElement>('video')
const poster = computed(() => videoPoster(props.src))
// True once the current playback has presented a frame; drives the fade-in.
const isReady = ref(false)

let nearObserver: IntersectionObserver | null = null
let viewObserver: IntersectionObserver | null = null
let attached = false
let isInView = false
let frameCallbackId = 0
let lastFrameAt = 0
let lastRecoverAt = 0
let watchdog: ReturnType<typeof setInterval> | undefined

function supportsFrameCallback(video: HTMLVideoElement) {
  return 'requestVideoFrameCallback' in video
}

function attach() {
  const video = videoRef.value
  if (!video || attached) return
  attached = true
  video.preload = 'auto'
  video.src = props.src
}

function stopFrameWatch() {
  const video = videoRef.value
  if (video && frameCallbackId && 'cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(frameCallbackId)
  frameCallbackId = 0
}

function watchFrames() {
  const video = videoRef.value
  if (!video || !supportsFrameCallback(video)) return
  stopFrameWatch()
  const tick = () => {
    lastFrameAt = performance.now()
    if (!isReady.value) isReady.value = true
    frameCallbackId = video.requestVideoFrameCallback(tick)
  }
  lastFrameAt = performance.now()
  frameCallbackId = video.requestVideoFrameCallback(tick)
}

function detach() {
  const video = videoRef.value
  if (!video || !attached) return
  stopFrameWatch()
  video.pause()
  video.removeAttribute('src')
  video.load()
  attached = false
  isReady.value = false
}

function play() {
  const video = videoRef.value
  if (!video) return
  attach()
  video.play().catch(() => {})
  watchFrames()
}

function pause() {
  const video = videoRef.value
  if (!video) return
  stopFrameWatch()
  video.pause()
  isReady.value = false
}

// Second "a frame is showing" signal, so the video can never stay
// invisible: the first presented frame (above) OR playback having really
// advanced (this). Whichever comes first fades the video in.
function onTimeUpdate() {
  const video = videoRef.value
  if (video && isInView && !isReady.value && !video.paused && video.currentTime > 0.05) isReady.value = true
}

function recover() {
  const now = performance.now()
  if (now - lastRecoverAt < 8000) return
  lastRecoverAt = now
  detach()
  play()
}

onMounted(() => {
  const video = videoRef.value
  if (!video) return

  nearObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) attach()
      else detach()
    }
  }, { rootMargin: '100% 0px' })
  nearObserver.observe(video)

  viewObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        isInView = true
        play()
      } else if (!entry.isIntersecting) {
        isInView = false
        pause()
      }
    }
  }, { threshold: [0, 0.5] })
  viewObserver.observe(video)

  watchdog = setInterval(() => {
    if (!isInView || !attached || document.visibilityState !== 'visible' || !supportsFrameCallback(video)) return
    if (video.paused || video.seeking || video.readyState < 3) return
    if (performance.now() - lastFrameAt > 3000) recover()
  }, 1500)
})

onBeforeUnmount(() => {
  nearObserver?.disconnect()
  viewObserver?.disconnect()
  clearInterval(watchdog)
  stopFrameWatch()
})
</script>

<template>
  <img class="vp-bare__poster" :src="poster" :width="width" :height="height" alt="" aria-hidden="true" decoding="async" />
  <video
    ref="video"
    class="vp-bare"
    :class="{ 'is-ready': isReady }"
    :width="width"
    :height="height"
    playsinline
    muted
    loop
    preload="none"
    @timeupdate="onTimeUpdate"
    @error="detach"
  />
</template>
