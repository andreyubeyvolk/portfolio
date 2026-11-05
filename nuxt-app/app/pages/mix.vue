<script setup lang="ts">
// HIDDEN TEST PAGE (not linked anywhere, noindex, not in the sitemap): a
// full-screen mosaic of random photos from every project (and pictures from the
// Archive), each with its project's name on hover. A click opens that photo's
// project at that photo, or that picture in the Archive's lightbox. Desktop only (wide window + a real mouse); anything else
// goes back to the home page.
//
// The mosaic is modular: the grid has 24 columns, a portrait photo (3:4) takes
// 3 of them and a landscape one (3:2) takes 6, and both are the same height, so
// every row is exactly full whatever the mix. Squares (Archive pictures) take 4
// columns and are the same height too. Photos are
// drawn from public/assets/mix/manifest.json (small thumbs, built by
// scripts/make-mix-thumbs.mjs), shuffled on every visit, and never put next to
// a photo of the same project.
interface Tile {
  src: string
  o: 'l' | 'p' | 's'
  title: string
  // where a click goes: a project page with ?img=<photo> (it scrolls to that
  // photo) or /archive?open=<n> (it opens that picture in the lightbox)
  to: string
}

useSeoMeta({
  title: 'Mix—Andrey Ubeyvolk',
  robots: 'noindex, nofollow',
})
useHead({ bodyAttrs: { class: 'mix-page' } })

const DESKTOP = '(min-width: 981px) and (hover: hover) and (pointer: fine)'
const COLS = 24
const ROWS_AT_FIRST = 8
const ROWS_PER_BATCH = 8

const rows = ref<Tile[][]>([])
const shownRows = ref(ROWS_AT_FIRST)
const tiles = computed(() => rows.value.slice(0, shownRows.value).flat())
const hasMore = computed(() => shownRows.value < rows.value.length)

const host = useTemplateRef<HTMLElement>('host')
const loaded = reactive(new Set<string>())

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

// Columns of the 24: landscape 3:2 = 6, portrait 3:4 = 3, square = 4. All three are
// the same height, so a row only has to add up to 24.
const span = (t: Tile) => (t.o === 'l' ? 6 : t.o === 'p' ? 3 : 4)
// What is left of a row must still be fillable by 3s, 4s and 6s (1, 2 and 5 are not).
const fillable = (free: number) => free === 0 || free === 3 || free === 4 || free >= 6

function pack(all: Tile[]): Tile[][] {
  const pool = shuffle(all)
  const out: Tile[][] = []
  const recent: string[] = []
  for (;;) {
    const row: Tile[] = []
    let free = COLS
    while (free > 0) {
      const head = pool.slice(0, 60)
      const fits = (t: Tile) => span(t) <= free && fillable(free - span(t))
      let at = head.findIndex(t => fits(t) && !recent.includes(t.title))
      if (at === -1) at = head.findIndex(fits)
      if (at === -1) at = pool.findIndex(fits)
      if (at === -1) break
      const [t] = pool.splice(at, 1)
      row.push(t!)
      free -= span(t!)
      recent.push(t!.title)
      if (recent.length > 3) recent.shift()
    }
    if (free !== 0) break
    out.push(row)
  }
  return out
}

// Same pattern as the Archive: "Load more" adds a batch of rows, and once
// everything is shown the button becomes "To top ↑".
function loadMore() {
  shownRows.value = Math.min(shownRows.value + ROWS_PER_BATCH, rows.value.length)
}
function toTop() {
  const pane = host.value?.querySelector<HTMLElement>('.content-pane__scroll')
  if (pane?.lenisInstance) pane.lenisInstance.scrollTo(0)
  else pane?.scrollTo({ top: 0, behavior: 'smooth' })
}

// The toggle (and Esc) go back to the page the mosaic was entered from, the home
// page if it was opened directly.
const backTo = ref('/')

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') navigateTo(backTo.value)
}

onMounted(async () => {
  if (!window.matchMedia(DESKTOP).matches) {
    await navigateTo('/', { replace: true })
    return
  }
  const previous = window.history.state?.back
  if (typeof previous === 'string' && previous.startsWith('/') && !previous.startsWith('//') && !previous.startsWith('/mix')) backTo.value = previous
  window.addEventListener('keydown', onKey)
  const data = await $fetch<Tile[]>('/assets/mix/manifest.json')
  rows.value = pack(data)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="mix-root">
    <div ref="host" class="mix-host">
      <!-- The site's own scroll pane: smooth (Lenis) scrolling and the custom square
           scrollbar, which sits in the 16px margin at the right edge. -->
      <ScrollPane>
        <div class="mix-content">
          <h1 class="sr-only">Selected work—Andrey Ubeyvolk</h1>
          <div class="mix-grid">
            <NuxtLink
              v-for="t in tiles"
              :key="t.src"
              class="mix-tile"
              :class="`mix-tile--${t.o}`"
              :to="t.to"
            >
              <span class="archive-title">{{ t.title }}</span>
              <span class="mix-tile__img" :class="{ 'is-loaded': loaded.has(t.src) }">
                <img
                  :src="t.src"
                  alt=""
                  decoding="async"
                  loading="lazy"
                  @load="loaded.add(t.src)"
                />
              </span>
            </NuxtLink>
          </div>
          <button v-if="hasMore" class="load-more-btn" type="button" @click="loadMore">Load more</button>
          <button v-else-if="rows.length" class="load-more-btn" type="button" @click="toTop">To top ↑</button>
        </div>
      </ScrollPane>
    </div>
    <MixToggle :to="backTo" label="Back" on />
  </div>
</template>

<style scoped>
.mix-root {
  --mix-margin: 16px;
}

/* Fills the screen above the 16px bottom margin. ScrollPane puts its pane inside and
   its custom scrollbar (16px wide, so exactly the margin) on this element's right edge. */
.mix-host {
  position: fixed;
  inset: 0 0 var(--mix-margin) 0;
  z-index: 50;
  background: #F5F4F4;
}
.mix-host :deep(.content-pane__scroll) {
  height: 100%;
  padding-top: var(--mix-margin);
  padding-left: var(--mix-margin);
}

/* The container the grid measures itself against: the pane's content box, which is
   the screen minus 16px on the left and the 16px scrollbar track on the right. */
.mix-content {
  --mix-gap: 12px;
  container-type: inline-size;
}

/* One grid column, and the shared photo height: a 6-column landscape at 3:2
   is as tall as a 3-column portrait at 3:4 (give or take the gaps). */
.mix-grid {
  --col: calc((100cqw - 23 * var(--mix-gap)) / 24);
  --photo-h: calc((6 * var(--col) + 5 * var(--mix-gap)) * 2 / 3);
  display: grid;
  grid-template-columns: repeat(24, minmax(0, 1fr));
  grid-auto-rows: var(--photo-h);
  gap: var(--mix-gap);
}

.mix-tile {
  position: relative;
  display: block;
  min-width: 0;
  min-height: 0;
}
.mix-tile--l { grid-column: span 6; }
.mix-tile--p { grid-column: span 3; }
.mix-tile--s { grid-column: span 4; }

/* The project name shows only on hover, across the top of the photo, full width, in
   the Archive's inverted style (white on black). */
.mix-tile .archive-title {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1;
  padding: 0 4px 1px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.8125rem;
  color: #fff;
  background-color: #000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .mix-tile:hover .archive-title {
    opacity: 1;
  }
}

.mix-tile__img {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #E6E5E5;
}
.mix-tile__img img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 400ms ease;
}
.mix-tile__img.is-loaded img {
  opacity: 1;
}
</style>
