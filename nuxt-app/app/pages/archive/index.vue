<script setup lang="ts">
// Stage 1: data + grid + Load more. Stage 2: desktop single-image
// lightbox. Stage 3: series cards (Transportation, YamiYami Case) open
// the filmstrip instead, via the same lightbox component. Stage 4:
// tablet/phone get their own card overlay (ArchiveCardOverlay.vue).
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

// Lightbox: controlled by index into the FULL flat catalog (all 92 items,
// including series continuation frames)--ArchivePreview needs that whole
// list to resolve a series' own frames and to step seamlessly past a
// group's boundary into the next single item, matching the static site's
// own itemsArr (which also includes the hidden .archive-series-extra
// frames--reachable via arrow-key stepping, just not their own grid card).
const allItems = computed(() => archive.value!.items)
const openIndex = ref<number | null>(null)
// Stage 4: tablet/phone get their own overlay (ArchiveCardOverlay)
// instead of the desktop lightbox--a separate index since the two never
// show at once (gated by breakpoint at click time, same as the static
// site's own `if (isMobile()) { ... } else { openPreviewFor(...) }`).
const mobileOpenIndex = ref<number | null>(null)

function isMobile() {
  return window.matchMedia('(max-width: 980px)').matches
}

function openCard(card: (typeof cards.value)[number]) {
  const idx = allItems.value.indexOf(card)
  if (idx === -1) return
  if (isMobile()) {
    mobileOpenIndex.value = idx
  } else {
    openIndex.value = idx
  }
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
        <button
          v-for="(card, i) in visibleCards"
          :key="card.src"
          type="button"
          class="archive-card"
          :class="{ 'archive-card--revealing': i >= revealingFrom }"
          @click="openCard(card)"
        >
          <div class="archive-card__cover">
            <img :width="card.width" :height="card.height" loading="lazy" :src="card.src" :alt="card.alt" />
          </div>
          <span class="archive-title">
            {{ splitArchiveTitle(card.title).base }}<sup v-if="splitArchiveTitle(card.title).badge" class="archive-num">{{ splitArchiveTitle(card.title).badge }}</sup>
          </span>
        </button>
      </article>

      <button v-if="hasMore" class="load-more-btn" type="button" @click="loadMore">Load more</button>
    </ScrollPane>
  </section>

  <ArchivePreview :items="allItems" :open-index="openIndex" @update:open-index="openIndex = $event" />
  <ArchiveCardOverlay :items="allItems" :open-index="mobileOpenIndex" @update:open-index="mobileOpenIndex = $event" />
</template>
