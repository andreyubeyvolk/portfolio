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
  tall?: boolean
}

const props = defineProps<{
  item: GalleryMediaItem
  wrapperClass: string
  skipReveal?: boolean
}>()

// CLAUDE.md's own documented exception: a .pv-wide photo exported taller
// than the standard 3:2 box (e.g. apac-17 at 2160x1780) needs its real
// aspect ratio instead of being cropped to fit--computed inline rather
// than a fixed .pv-wide--tall CSS class since the "how much taller" varies
// per photo. Mobile never has this problem (.mobile-project__photo img is
// always natural height:auto there), so this only applies to .pv-wide.
const tallStyle = computed(() => (props.wrapperClass === 'pv-wide' && props.item.tall)
  ? { aspectRatio: `${props.item.width} / ${props.item.height}` }
  : undefined)

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
    class="gallery-slot"
    :class="[wrapperClass, { reveal: !skipReveal, 'is-revealed': isRevealed, 'info-note': item.note, 'is-note-open': isNoteOpen }]"
    :style="tallStyle"
  >
    <img v-if="item.type === 'image'" :width="item.width" :height="item.height" loading="lazy" :src="item.src" :alt="item.alt || ''" />
    <!-- `paired` (cropped, absolutely positioned to fill the box) only
         makes sense when there IS a sized box (a wrapperClass) to fill--a
         standalone top-level video (empty wrapperClass, see
         ProjectPage.vue's 'video' row) needs its natural free-flowing
         height instead, same as it gets outside any pair. -->
    <Vp v-else-if="item.player === 'full'" :src="item.src" :paired="!!wrapperClass" autoplay="scroll" />
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

<style scoped>
/* .pv-wide/.pv-pair__photo/.mobile-project__photo all zero this
   themselves--only matters when wrapperClass is empty (a standalone
   top-level video, see ProjectPage.vue's 'video' row), where the
   browser's own default <figure> margin would otherwise leak in. */
.gallery-slot {
  margin: 0;
}
</style>
