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
  tip?: string
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
// Skipped items (already on/near screen at load, per the comment above)
// never got any load treatment at all--fine on desktop/fast connections,
// but on mobile these first couple of photos can sit blank-white for a
// beat then pop in fully loaded. Mobile-only CSS (mobile.css) fades the
// <img> in on its own load event instead, gated by this class--separate
// from isRevealed/.reveal above, which stays a no-op for skipped items.
const isImgLoaded = ref(false)
const isNoteOpen = ref(false)

// Cursor-follow hover caption (valera, CLAUDE.md's vp-tipslot pattern).
// Shows ~1s after the cursor rests over the slide, positioned just
// below-right of the cursor and clamped to the viewport.
const tipLines = computed(() => props.item.tip?.split('|').map(s => s.trim()) ?? [])
const isTipVisible = ref(false)
const tipStyle = ref<{ left: string, top: string }>({ left: '0px', top: '0px' })
let tipTimer: ReturnType<typeof setTimeout> | undefined

function onTipMove(e: MouseEvent) {
  isTipVisible.value = false
  clearTimeout(tipTimer)
  const cx = e.clientX
  const cy = e.clientY
  tipTimer = setTimeout(() => {
    const off = 16
    // Rough box estimate before layout--good enough to keep the tip on
    // screen; the browser reflows the actual span widths immediately after.
    const tw = Math.max(...tipLines.value.map(l => l.length)) * 8 + 10
    const th = tipLines.value.length * 26
    let left = cx + off
    let top = cy + off
    if (left + tw > window.innerWidth - 8) left = cx - off - tw
    if (top + th > window.innerHeight - 8) top = cy - off - th
    if (left < 8) left = 8
    if (top < 8) top = 8
    tipStyle.value = { left: `${left}px`, top: `${top}px` }
    isTipVisible.value = true
  }, 1000)
}
function onTipLeave() {
  clearTimeout(tipTimer)
  isTipVisible.value = false
}

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
  if (props.skipReveal) {
    const img = el.value?.querySelector('img')
    if (img && !(img as HTMLImageElement).complete) {
      const onLoaded = () => { isImgLoaded.value = true }
      img.addEventListener('load', onLoaded, { once: true })
      img.addEventListener('error', onLoaded, { once: true })
    } else {
      isImgLoaded.value = true
    }
  }

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
  clearTimeout(tipTimer)
})
</script>

<template>
  <figure
    ref="el"
    class="gallery-slot"
    :class="[wrapperClass, { reveal: !skipReveal, 'is-revealed': isRevealed, 'skip-reveal-fade': skipReveal, 'is-img-loaded': isImgLoaded, 'info-note': item.note, 'is-note-open': isNoteOpen }]"
    :style="tallStyle"
    @mousemove="item.tip ? onTipMove($event) : undefined"
    @mouseleave="item.tip ? onTipLeave() : undefined"
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

    <Teleport v-if="item.tip" to="body">
      <div class="vp-tip" :class="{ 'is-visible': isTipVisible }" :style="tipStyle">
        <span v-for="(line, idx) in tipLines" :key="idx">{{ line }}</span>
      </div>
    </Teleport>
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
