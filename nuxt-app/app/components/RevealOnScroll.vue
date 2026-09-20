<script setup lang="ts">
// Fade+rise-into-view wrapper, ported from scroll-reveal.js. That script
// queried the whole page once and skipped a fixed number of leading items
// (already on/near screen at load, nothing to "reveal"); here the caller
// decides that per-instance via `skip`, since with the gallery now built
// from one data loop (see ProjectPage.vue) computing "is this the Nth
// item" is trivial at the call site and doesn't need a global DOM query.
const props = defineProps<{ skip?: boolean }>()

const el = useTemplateRef<HTMLElement>('el')
const isRevealed = ref(!!props.skip)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (props.skip || !el.value) return
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer?.unobserve(entry.target)
      const img = (entry.target as HTMLElement).querySelector('img')
      if (img && !(img as HTMLImageElement).complete) {
        const reveal = () => { isRevealed.value = true }
        img.addEventListener('load', reveal, { once: true })
        img.addEventListener('error', reveal, { once: true })
      } else {
        isRevealed.value = true
      }
    }
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0 })
  observer.observe(el.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="el" class="reveal" :class="{ 'is-revealed': isRevealed }">
    <slot />
  </div>
</template>
