<script setup lang="ts">
import type { ArchiveLightboxItem } from '~/components/ArchivePreview.vue'

// Stage 1 of the Archive migration: data + grid + Load more only. Stage 2
// adds the desktop single-image lightbox for non-series cards.
const { data: archive } = await useAsyncData('archive', () => queryCollection('archive').first())

if (!archive.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

// Only the items with their own grid card--a series' continuation frames
// (isCard: false) are stored for the lightbox stages but don't render here.
const cards = computed(() => archive.value!.items.filter(item => item.isCard))

// Batch size differs by breakpoint (28/click on desktop+tablet, 20 on
// phone), decided once on mount--not worth reacting live to a mid-browse
// resize (matches the static site's own load-more.js).
const BATCH_DESKTOP = 28
const BATCH_PHONE = 20
function currentBatch() {
  return window.matchMedia('(max-width: 640px)').matches ? BATCH_PHONE : BATCH_DESKTOP
}

const shown = ref(BATCH_DESKTOP)
// Index the current reveal batch starts at, while its fade-in transition
// is still pending--Infinity once settled, so no card carries the
// fade-from-invisible class the rest of the time.
const revealingFrom = ref(Infinity)

onMounted(() => {
  shown.value = Math.min(currentBatch(), cards.value.length)
})

const visibleCards = computed(() => cards.value.slice(0, shown.value))
const hasMore = computed(() => shown.value < cards.value.length)

// Stage 2: single-image lightbox, desktop only--series cards (`group` set)
// aren't clickable yet, that's Stage 3's filmstrip. The flat catalog
// prev/next cycles through is every non-series card currently in the DOM
// (not just the ones already revealed by Load more--stepping forward from
// the last-loaded card shouldn't dead-end, same reasoning as the static
// site's own itemsArr covering cards still hidden behind its Load more).
const steppableCards = computed(() => cards.value.filter(card => !card.group))
const openIndex = ref<number | null>(null)
const currentItem = computed<ArchiveLightboxItem | null>(() => {
  if (openIndex.value === null) return null
  const card = steppableCards.value[openIndex.value]
  if (!card) return null
  return {
    src: card.src,
    width: card.width,
    height: card.height,
    alt: card.alt,
    title: card.frameTitle ?? card.title,
    description: card.description,
    link: card.link,
    tags: card.tags,
  }
})

function isMobile() {
  return window.matchMedia('(max-width: 980px)').matches
}

function openCard(card: (typeof cards.value)[number]) {
  if (isMobile() || card.group) return
  const idx = steppableCards.value.indexOf(card)
  if (idx !== -1) openIndex.value = idx
}

function stepPreview(dir: 1 | -1) {
  if (openIndex.value === null || !steppableCards.value.length) return
  openIndex.value = (openIndex.value + dir + steppableCards.value.length) % steppableCards.value.length
}

function loadMore() {
  const from = shown.value
  revealingFrom.value = from
  shown.value = Math.min(shown.value + currentBatch(), cards.value.length)
  // Two frames, not one: the newly-mounted cards need to actually paint at
  // opacity:0 (the .archive-card--revealing starting state) before dropping
  // that class has an opacity:1 transition to animate from--doing it in the
  // same tick would just paint the end state directly, with nothing to fade.
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { revealingFrom.value = Infinity })
    })
  })
}

useSeoMeta({
  title: `${archive.value.title}—Andrey Ubeyvolk`,
  description: archive.value.description,
  ogTitle: `${archive.value.title}—Andrey Ubeyvolk`,
  ogDescription: archive.value.description,
  twitterTitle: `${archive.value.title}—Andrey Ubeyvolk`,
  twitterDescription: archive.value.description,
})

useHead({
  bodyAttrs: { class: 'archive-page' },
})
</script>

<template>
  <section class="section-intro intro" aria-label="Archive section introduction">
    <h1 class="section-page-title">{{ archive.title }}</h1>
    <p>{{ archive.intro }}</p>
  </section>

  <section class="content-pane" aria-label="Archive projects">
    <ScrollPane>
      <article class="archive-grid">
        <component
          :is="card.group ? 'div' : 'button'"
          v-for="(card, i) in visibleCards"
          :key="card.src"
          :type="card.group ? undefined : 'button'"
          class="archive-card"
          :class="{ 'archive-card--revealing': i >= revealingFrom }"
          @click="card.group ? undefined : openCard(card)"
        >
          <div class="archive-card__cover">
            <img :width="card.width" :height="card.height" loading="lazy" :src="card.src" :alt="card.alt" />
          </div>
          <span class="archive-title">
            {{ splitArchiveTitle(card.title).base }}<sup v-if="splitArchiveTitle(card.title).badge" class="archive-num">{{ splitArchiveTitle(card.title).badge }}</sup>
          </span>
        </component>
      </article>

      <button v-if="hasMore" class="load-more-btn" type="button" @click="loadMore">Load more</button>
    </ScrollPane>
  </section>

  <ArchivePreview :item="currentItem" @close="openIndex = null" @prev="stepPreview(-1)" @next="stepPreview(1)" />
</template>
