<script setup lang="ts">
// Silent, looping, autoplay-on-scroll video with zero player chrome.
// Ported from video-player.js's .vp-bare handling.
defineProps<{ src: string; width: number; height: number }>()

const videoRef = useTemplateRef<HTMLVideoElement>('video')
let observer: IntersectionObserver | null = null

onMounted(() => {
  const video = videoRef.value
  if (!video) return
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
    loop
    preload="metadata"
    :src="src"
  />
</template>
