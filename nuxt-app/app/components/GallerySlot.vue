<script setup lang="ts">
// One gallery slot: a photo or video, in either a full-width (.pv-wide) or
// half-width paired (.pv-pair__photo) box. Combines three previously-
// separate concerns from the static site onto this one element, exactly
// as the original markup did (e.g. dragon-09: a single <div
// class="pv-pair__photo info-note"> carries both classes at once):
//   - the wrapper class itself (passed in via `wrapperClass`)
//   - scroll-reveal fade+rise (ported from scroll-reveal.js)
//   - the optional tap-to-reveal info-note caption (ported from info-note.js)
// Splitting these into separate wrapper components would mean extra
// nested <div>s breaking the flex/aspect-ratio contract every .pv-wide/
// .pv-pair__photo CSS rule assumes for its DIRECT element.
export interface GalleryMediaItem {
  type: 'image' | 'video'
  src: string
  width: number
  height: number
  alt?: string
  note?: string
  player?: 'bare' | 'full'
}

const props = defineProps<{
  item: GalleryMediaItem
  wrapperClass: string
  skipReveal?: boolean
}>()

const el = useTemplateRef<HTMLElement>('el')
const isRevealed = ref(!!props.skipReveal)
const isNoteOpen = ref(false)

let revealObserver: IntersectionObserver | null = null
let noteObserver: IntersectionObserver | null = null
let closeTimer: ReturnType<typeof setTimeout> | undefined

const AUTO_CLOSE_MS = 10000

function openNote() {
  isNoteOpen.value = true
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => { isNoteOpen.value = false }, AUTO_CLOSE_MS)
}
function closeNote() {
  isNoteOpen.value = false
  clearTimeout(closeTimer)
}
function toggleNote(e: MouseEvent) {
  e.stopPropagation()
  if (isNoteOpen.value) closeNote()
  else openNote()
}

onMounted(() => {
  if (!props.skipReveal && el.value) {
    revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        revealObserver?.unobserve(entry.target)
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
    revealObserver.observe(el.value)
  }

  if (props.item.note && el.value) {
    noteObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) closeNote()
      }
    }, { threshold: 0 })
    noteObserver.observe(el.value)
  }
})

onBeforeUnmount(() => {
  revealObserver?.disconnect()
  noteObserver?.disconnect()
  clearTimeout(closeTimer)
})
</script>

<template>
  <figure
    ref="el"
    :class="[wrapperClass, { reveal: !skipReveal, 'is-revealed': isRevealed, 'info-note': item.note, 'is-note-open': isNoteOpen }]"
  >
    <img v-if="item.type === 'image'" :width="item.width" :height="item.height" loading="lazy" :src="item.src" :alt="item.alt || ''" />
    <Vp v-else-if="item.player === 'full'" :src="item.src" paired autoplay="scroll" />
    <VpBare v-else :src="item.src" :width="item.width" :height="item.height" />

    <div v-if="item.note" class="info-note__bar">
      <button type="button" class="info-note__toggle" :aria-expanded="isNoteOpen" aria-label="More info" @click="toggleNote">
        <span class="info-note__icon">{{ isNoteOpen ? 'X' : 'i' }}</span>
      </button>
      <div class="info-note__panel">
        <span class="info-note__text">{{ item.note }}</span>
      </div>
    </div>
  </figure>
</template>
