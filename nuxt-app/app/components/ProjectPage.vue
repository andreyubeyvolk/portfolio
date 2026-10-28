<script setup lang="ts">
// The one template every project page (Inhouse + Brands, 12 pages) now
// shares, driven entirely by content/projects/**/*.md data. Renders BOTH
// the desktop (.project-content, pv-wide/pv-pair gallery) and mobile
// (.mobile-project, flattened photo list) layouts from the SAME `gallery`
// array—CSS media queries still decide which one is visible, exactly like
// the static site, but there's now one gallery data source instead of two
// hand-kept-in-sync copies of the markup.
import type { GalleryMediaItem } from './GallerySlot.vue'

type GalleryRow =
  | { type: 'wide', item: GalleryMediaItem }
  | { type: 'pair', items: [GalleryMediaItem, GalleryMediaItem] }
  | { type: 'video', item: GalleryMediaItem }
  | { type: 'text', label: string, text: string, hidden?: boolean }

const props = defineProps<{
  section: 'inhouse' | 'brands'
  slug: string
  title: string
  cover: GalleryMediaItem
  about: string
  gallery: GalleryRow[]
  challenge: string
  solution: string
  kv: { src: string, width: number, height: number, canvas?: boolean }
  zipUrl?: string
}>()

const introText = computed(() => sectionIntroText(props.section))

// The cover is the page's largest above-the-fold paint. An image cover
// gets fetchpriority="high" on the <img> itself; a video cover's first
// visible paint is its poster, which the <video> element would otherwise
// only request at normal priority.
if (props.cover.type === 'video') {
  useHead({
    link: [{ rel: 'preload', as: 'image', href: videoPoster(props.cover.src), fetchpriority: 'high' }],
  })
}

const panelTransitionStyle = usePanelTransitionStyle()

// e.g. "nimax" → "Andrey_Ubeyvolk_Nimax.zip"
const zipFilename = computed(() => {
  const name = props.title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+$/, '')
  return `Andrey_Ubeyvolk_${name}.zip`
})

// Flat running index across the whole gallery (a pair row counts as two),
// matching the static site's own "skip the first N already-visible items"
// scroll-reveal rule—see RevealOnScroll.vue/GallerySlot.vue.
const flatGallery = computed(() => {
  let idx = 0
  return props.gallery.filter(row => !(row.type === 'text' && row.hidden)).map((row) => {
    // A text row isn't a photo--it must not shift the "skip the first N
    // already-visible items" count.
    if (row.type === 'text') return { ...row, flatIndex: idx }
    if (row.type === 'pair') {
      const out = { ...row, flatIndexes: [idx, idx + 1] as [number, number] }
      idx += 2
      return out
    }
    const out = { ...row, flatIndex: idx }
    idx += 1
    return out
  })
})
</script>

<template>
  <!-- No <main>/<SiteNav> here—layouts/default.vue (see Stage 2) already
       provides those and passes this component's own root nodes into its
       <slot />, same as about.vue. -->
  <section class="section-intro intro" :aria-label="`${section === 'inhouse' ? 'Inhouse' : 'Brands'} section introduction`">
    <p>{{ introText }}</p>
  </section>

    <section class="content-pane project-frame" :aria-label="`${title} project content`" :style="panelTransitionStyle">
      <header class="content-pane__header project-header">
        <h1>{{ title }}</h1>
        <NuxtLink class="close-button" :to="`/${section}`" aria-label="Close project"><span>[X]</span></NuxtLink>
      </header>
      <ScrollPane project-scroll>
        <article class="project-content">
          <figure class="pv-cover">
            <img
              v-if="cover.type === 'image'"
              v-pinch-zoom
              :width="cover.width"
              :height="cover.height"
              fetchpriority="high"
              :src="cover.src"
              :alt="title"
            />
            <VpBare v-else :src="cover.src" :width="cover.width" :height="cover.height" />
          </figure>

          <RevealOnScroll class="pv-row pv-row--about">
            <span class="pv-row__label">About</span>
            <TextBlock class="pv-row__content" :text="about" />
          </RevealOnScroll>

          <template v-for="(row, i) in flatGallery" :key="i">
            <RevealOnScroll v-if="row.type === 'text'" class="pv-row pv-row--about">
              <span class="pv-row__label">{{ row.label }}</span>
              <TextBlock class="pv-row__content" :text="row.text" />
            </RevealOnScroll>
            <GallerySlot
              v-else-if="row.type === 'wide'"
              :item="row.item"
              wrapper-class="pv-wide"
              :skip-reveal="row.flatIndex === 0"
            />
            <div v-else-if="row.type === 'pair'" class="pv-pair">
              <GallerySlot :item="row.items[0]" wrapper-class="pv-pair__photo" :skip-reveal="row.flatIndexes![0] === 0" />
              <GallerySlot :item="row.items[1]" wrapper-class="pv-pair__photo" :skip-reveal="row.flatIndexes![1] === 0" />
            </div>
            <!-- Standalone full-width video: natural aspect, not cropped
                 into a pv-wide box (see content.config.ts's 'video' row
                 comment). GallerySlot with an empty wrapper class still
                 gets it reveal + info-note support for free (e.g.
                 greenflag-01/26, both standalone AND noted). -->
            <GallerySlot v-else :item="row.item" wrapper-class="" :skip-reveal="row.flatIndex === 0" />
          </template>

          <div class="pv-info">
            <RevealOnScroll class="pv-row">
              <span class="pv-row__label">Challenge</span>
              <TextBlock class="pv-row__content" :text="challenge" />
            </RevealOnScroll>

            <div class="pv-solution-block">
              <div class="pv-divider" />
              <RevealOnScroll class="pv-row">
                <span class="pv-row__label">Solution</span>
                <div class="pv-solution">
                  <div class="pv-solution__body">
                    <TextBlock class="pv-solution__text" :text="solution" />
                    <KvIcon variant="desktop" :src="kv.src" :width="kv.width" :height="kv.height" :canvas="kv.canvas" />
                  </div>
                  <div class="pv-actions">
                    <div class="pv-action">
                      <div class="pv-action__bar" />
                      <a v-if="zipUrl" class="pv-action__btn" :href="zipUrl" :download="zipFilename">Download project images</a>
                      <span v-else class="pv-action__btn">Download project images</span>
                    </div>
                    <div class="pv-action">
                      <div class="pv-action__bar" />
                      <NextProjectButton :section="section" :slug="slug">Next project</NextProjectButton>
                    </div>
                  </div>
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </article>
      </ScrollPane>
    </section>

  <!-- ── MOBILE LAYOUT ──
       Teleported out from under <main> (display:none on mobile) to Nuxt's
       own reserved "#teleports" container--see the comment in
       layouts/default.vue on why a custom target selector here silently
       loses its content during SSR. -->
  <Teleport to="#teleports">
  <div class="project-bar" id="project-bar">
    <span class="project-bar__title">{{ title }}</span>
    <NuxtLink class="project-bar__close" :to="`/${section}`" aria-label="Close project">[X]</NuxtLink>
  </div>

  <div class="mobile-project">
    <img v-if="cover.type === 'image'" v-pinch-zoom :width="cover.width" :height="cover.height" fetchpriority="high" :src="cover.src" :alt="title" />
    <div v-else class="mobile-project__video">
      <VpBare :src="cover.src" :width="cover.width" :height="cover.height" />
    </div>

    <RevealOnScroll class="mobile-project__block">
      <span class="mobile-project__label">About</span>
      <TextBlock class="mobile-project__text" :text="about" />
    </RevealOnScroll>

    <template v-for="(row, i) in flatGallery" :key="i">
      <RevealOnScroll v-if="row.type === 'text'" class="mobile-project__block">
        <span class="mobile-project__label">{{ row.label }}</span>
        <TextBlock class="mobile-project__text" :text="row.text" />
      </RevealOnScroll>
      <GallerySlot
        v-else-if="row.type === 'wide'"
        :item="row.item"
        wrapper-class="mobile-project__photo"
        :skip-reveal="row.flatIndex! < 2"
      />
      <template v-else-if="row.type === 'pair'">
        <!-- A full-audio player paired with a photo on desktop (cropped
             into the 3:4 slot via Vp's `paired` mode) has no mobile
             equivalent box to crop into--the static site's own mobile
             markup for this case (see finance-stories.mp4) just drops it
             in full-width and standalone, same as a top-level 'video'
             row, with its paired photo rendered separately right after. -->
        <GallerySlot
          v-for="(item, j) in row.items"
          :key="j"
          :item="item"
          :wrapper-class="item.type === 'video' && item.player !== 'bare' ? '' : 'mobile-project__photo'"
          :skip-reveal="row.flatIndexes![j] < 2"
        />
      </template>
      <GallerySlot v-else :item="row.item" wrapper-class="" :skip-reveal="row.flatIndex! < 2" />
    </template>

    <div class="mobile-project__blocks">
      <RevealOnScroll class="mobile-project__block">
        <span class="mobile-project__label">Challenge</span>
        <TextBlock class="mobile-project__text" :text="challenge" />
      </RevealOnScroll>

      <div class="mobile-solution-group">
        <RevealOnScroll class="mobile-project__block mobile-project__block--divider">
          <span class="mobile-project__label">Solution</span>
          <div class="mobile-project__solution">
            <TextBlock class="mobile-project__text" :text="solution" />
            <KvIcon variant="mobile" :src="kv.src" :width="kv.width" :height="kv.height" />
          </div>
        </RevealOnScroll>

        <div class="mobile-project__actions">
          <div class="mobile-project__action">
            <div class="mobile-project__action-bar" />
            <a v-if="zipUrl" class="mobile-project__action-btn" :href="zipUrl" :download="zipFilename">Download project images</a>
            <span v-else class="mobile-project__action-btn">Download project images</span>
          </div>
          <div class="mobile-project__action">
            <div class="mobile-project__action-bar" />
            <NextProjectButton :section="section" :slug="slug">Next project</NextProjectButton>
          </div>
        </div>
      </div>
    </div>
  </div>
  </Teleport>
</template>
