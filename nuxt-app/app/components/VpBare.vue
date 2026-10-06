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
  // No-op if the browser already started playing via the attribute.
  video.play().catch(() => {})
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
