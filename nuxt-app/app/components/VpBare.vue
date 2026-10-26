<script setup lang="ts">
// Silent, looping, autoplay-on-scroll video with zero player chrome.
// Ported from video-player.js's .vp-bare handling.
defineProps<{ src: string; width: number; height: number }>()

const videoRef = useTemplateRef<HTMLVideoElement>('video')
let observer: IntersectionObserver | null = null

onMounted(() => {
  const video = videoRef.value
  if (!video) return
  // Explicit play attempt for iOS Safari, which sometimes ignores the
  // `autoplay` HTML attribute even with `muted playsinline` present.
  // No-op if the browser already started playing via the attribute. Only
  // for a video that's on screen right now: a page can hold ten of these,
  // and forcing every off-screen one to start downloading at once would
  // swamp a phone connection (the observer below starts the rest on scroll).
  const rect = video.getBoundingClientRect()
  if (rect.top < window.innerHeight && rect.bottom > 0) video.play().catch(() => {})
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      video.play().catch(() => {})
      observer?.disconnect()
    }
  }, { threshold: 0.5 })
  observer.observe(video)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <video
    ref="video"
    class="vp-bare"
    :width="width"
    :height="height"
    playsinline
    muted
    autoplay
    loop
    preload="metadata"
    :poster="videoPoster(src)"
    :src="src"
  />
</template>
