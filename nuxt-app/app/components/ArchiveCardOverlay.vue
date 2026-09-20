<script setup lang="ts">
import type { ArchiveFlatItem } from '~/utils/archiveTypes'

// Tablet/phone card overlay for the Archive (Stage 4). Two very different
// layouts share one overlay element (#card-overlay/.card-panel), matching
// the static site's own single DOM structure re-skinned per breakpoint:
//   - Tablet (641-980px): single card, sized to the photo's own aspect
//     ratio (fitCardPanel)--no swipe, no arrows; closing and clicking a
//     different grid card is the only way to see another.
//   - Phone (<=640px): every catalog item (all 92, including a series'
//     own continuation frames--there's no filmstrip concept on mobile,
//     just one long flat swipe deck) becomes its own slide in a native
//     CSS scroll-snap track; the header title follows the active slide.
// The mode is decided once, at open time (matching openTabletCard/
// openMobileCard on the static site)--resizing across the breakpoint
// while already open doesn't switch layouts, same as there.
const props = defineProps<{ items: ArchiveFlatItem[], openIndex: number | null }>()
const emit = defineEmits<{ 'update:openIndex': [value: number | null] }>()

const currentEntry = computed(() => props.openIndex !== null ? props.items[props.openIndex] ?? null : null)

const isOpen = ref(false)
const isPhoneMode = ref(false)
// Phone mode: the header title tracks whichever slide is currently
// scrolled into view (activeSlideIndex), not the originally-clicked
// item--matches the static site's own updateTitleFromScroll. Tablet mode
// has no scrolling, so it's always just the opened item.
const headerEntry = computed(() => isPhoneMode.value ? props.items[activeSlideIndex.value] ?? null : currentEntry.value)
const titleParts = computed(() => headerEntry.value ? splitArchiveTitle(headerEntry.value.frameTitle ?? headerEntry.value.title) : null)

const cardPanel = useTemplateRef<HTMLElement>('cardPanel')
const cardHeader = useTemplateRef<HTMLElement>('cardHeader')
const tabletImg = useTemplateRef<HTMLImageElement>('tabletImg')
const cardTrack = useTemplateRef<HTMLElement>('cardTrack')

function isPhone() {
  return window.matchMedia('(max-width: 640px)').matches
}

// ── Tablet: single card sized to the image's own aspect ratio ──────────
function fitCardPanel() {
  const img = tabletImg.value
  const panel = cardPanel.value
  if (!img || !panel) return
  const naturalW = img.naturalWidth
  const naturalH = img.naturalHeight
  if (!naturalW || !naturalH) return

  const inset = 16
  const ratio = naturalW / naturalH
  const maxImgW = window.innerWidth - inset * 2

  img.style.width = '0px'
  img.style.height = '0px'
  panel.style.width = `${maxImgW}px`
  let nonImgH = panel.getBoundingClientRect().height
  let maxImgH = window.innerHeight - inset * 2 - nonImgH

  let imgW = maxImgW
  let imgH = imgW / ratio

  if (imgH > maxImgH) {
    imgH = maxImgH
    imgW = imgH * ratio
    panel.style.width = `${Math.round(imgW)}px`
    nonImgH = panel.getBoundingClientRect().height
    maxImgH = window.innerHeight - inset * 2 - nonImgH
    if (imgH > maxImgH) {
      imgH = maxImgH
      imgW = imgH * ratio
    }
  }

  imgW = Math.round(imgW)
  imgH = Math.round(imgH)
  img.style.width = `${imgW}px`
  img.style.height = `${imgH}px`
  panel.style.width = `${imgW}px`
}

function onTabletImgLoad() {
  fitCardPanel()
}

// ── Phone: flat swipe deck of every catalog item ────────────────────────
const activeSlideIndex = ref(0)
const isSwipeHintActive = ref(false)

function slideStride() {
  const track = cardTrack.value
  if (!track?.firstElementChild) return 1
  return track.firstElementChild.getBoundingClientRect().width + 16
}

function onTrackScroll() {
  const track = cardTrack.value
  if (!track?.firstElementChild) return
  let idx = Math.round(track.scrollLeft / slideStride())
  idx = Math.max(0, Math.min(props.items.length - 1, idx))
  activeSlideIndex.value = idx
}

// First-ever mobile card open only: a small peek-and-settle wiggle on the
// deck (see .card-track.is-swipe-hint in mobile.css), signaling "this
// swipes sideways" before the user has to discover it by accident. Never
// repeats once seen, and skipped entirely if there's nothing to swipe to.
function maybeShowSwipeHint() {
  const KEY = 'archiveSwipeHintSeen'
  let seen: string | null
  try { seen = localStorage.getItem(KEY) } catch { seen = '1' }
  if (seen || props.items.length < 2) return
  isSwipeHintActive.value = true
  try { localStorage.setItem(KEY, '1') } catch { /* private browsing / storage disabled--just skip the hint next time too */ }
}

function onSwipeHintAnimationEnd() {
  isSwipeHintActive.value = false
}

// ── Open/close ───────────────────────────────────────────────────────
watch(() => props.openIndex, async (idx) => {
  if (idx === null) return
  isOpen.value = true
  isPhoneMode.value = isPhone()
  document.body.classList.add('card-is-open')
  await nextTick()
  if (isPhoneMode.value) {
    activeSlideIndex.value = idx
    requestAnimationFrame(() => {
      if (cardTrack.value) cardTrack.value.scrollLeft = idx * slideStride()
      maybeShowSwipeHint()
    })
  } else {
    const img = tabletImg.value
    if (img?.complete && img.naturalWidth) fitCardPanel()
  }
})

function close() {
  isOpen.value = false
  document.body.classList.remove('card-is-open')
  if (cardPanel.value) cardPanel.value.style.width = ''
  emit('update:openIndex', null)
}

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) close()
}

function onResize() {
  if (!isOpen.value) return
  if (isPhoneMode.value) {
    if (cardTrack.value) cardTrack.value.scrollLeft = activeSlideIndex.value * slideStride()
  } else {
    fitCardPanel()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) close()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('card-is-open')
})
</script>

<template>
  <!-- Teleported out of .site-shell (Nuxt only ever splices "body" and its
       own reserved "#teleports" container into SSR output--see
       layouts/default.vue's own comment on this, and the identical reason
       ProjectPage.vue's mobile content teleports there too). The static
       site's own #card-overlay is a sibling of <main>, outside .site-shell
       entirely; without this, body.card-is-open's ".site-shell { opacity:
       0.08 }" dim rule (meant to fade the BACKGROUND behind the card)
       caught the card overlay too, since it was rendering as a descendant
       of .site-shell instead--the whole page, card included, read as one
       uniformly washed-out ghost. -->
  <Teleport to="#teleports">
  <div v-if="isOpen" class="card-overlay" @click="onOverlayClick">
    <div ref="cardPanel" class="card-panel">
      <div ref="cardHeader" class="card-panel__header">
        <p class="card-panel__title">{{ titleParts?.base }}<sup v-if="titleParts?.badge" class="archive-num">{{ titleParts.badge }}</sup></p>
        <button class="card-panel__close" type="button" @click="close">[X]</button>
      </div>

      <template v-if="!isPhoneMode">
        <div class="card-panel__image-wrap">
          <img ref="tabletImg" class="card-panel__image" :src="currentEntry?.src" :alt="currentEntry?.alt || ''" @load="onTabletImgLoad" />
        </div>
        <div class="card-panel__desc">
          <p v-if="currentEntry && splitArchiveDescription(currentEntry.description, currentEntry.link)" class="card-panel__desc-text">
            {{ splitArchiveDescription(currentEntry.description, currentEntry.link)!.before }}<a class="archive-num" :href="currentEntry.link" target="_blank" rel="noreferrer">{{ splitArchiveDescription(currentEntry.description, currentEntry.link)!.linkText }}</a>{{ splitArchiveDescription(currentEntry.description, currentEntry.link)!.after }}
          </p>
          <p v-else class="card-panel__desc-text">{{ currentEntry?.description }}</p>
        </div>
        <span v-if="currentEntry?.tags" class="card-panel__tags">{{ currentEntry.tags }}</span>
      </template>

      <div
        v-else
        ref="cardTrack"
        class="card-track"
        :class="{ 'is-swipe-hint': isSwipeHintActive }"
        @scroll="onTrackScroll"
        @animationend="onSwipeHintAnimationEnd"
      >
        <div v-for="slide in items" :key="slide.src" class="card-slide">
          <div class="card-panel__image-wrap">
            <img class="card-panel__image" loading="lazy" :src="slide.src" :alt="slide.alt" />
          </div>
          <div class="card-panel__desc">
            <p v-if="splitArchiveDescription(slide.description, slide.link)" class="card-panel__desc-text">
              {{ splitArchiveDescription(slide.description, slide.link)!.before }}<a class="archive-num" :href="slide.link" target="_blank" rel="noreferrer">{{ splitArchiveDescription(slide.description, slide.link)!.linkText }}</a>{{ splitArchiveDescription(slide.description, slide.link)!.after }}
            </p>
            <p v-else class="card-panel__desc-text">{{ slide.description }}</p>
          </div>
          <span v-if="slide.tags" class="card-panel__tags">{{ slide.tags }}</span>
        </div>
      </div>
    </div>
  </div>
  </Teleport>
</template>
