<script setup lang="ts">
// Shared listing card for Inhouse/Brands (ProjectGrid.vue) and "See all
// projects" (all-projects/index.vue)--both rendered the same
// `.inhouse-card` markup inline before this was extracted, so the new
// hover-preview mechanic below only has to be written once and applies
// everywhere per its own design brief.
//
// Hover preview: for a project with `cardPreview` set (iGaming, Crypto,
// Finance, Identity, and the four Brands projects so far--every other
// project has none and this is fully inert), moving the cursor
// left-to-right across the card (or dragging a finger the same way on
// touch) cycles through up to 4 photos, shown centered over the cover
// at half the card's own size. No existing
// pattern to build on--GallerySlot.vue's cursor-follow tip is an
// absolute-position tooltip follower, not a position-within-element
// picker, so this is a fresh implementation.
interface CardPreviewItem { src: string, width: number, height: number }

const props = defineProps<{
  section: 'inhouse' | 'brands'
  slug: string
  title: string
  cardPreview?: CardPreviewItem[]
}>()

const cardRef = useTemplateRef('cardRef')
const activeIndex = ref<number | null>(null)

// Only cardPreview[0] loads for free (it's the <img>'s default src below,
// whenever nothing's active)--indices 1-3 previously only started
// fetching the first time a hover/drag actually reached that segment, a
// real network wait on a first pass across the card. Warming all of them
// as plain Image() fetches (not <link rel=preload>--on a listing page
// with several of these cards, that many preload hints competing for
// priority with the cards' own visible cover images is worse than just
// letting the browser schedule ordinary background requests) means
// they're already in the HTTP cache by the time the user's cursor/finger
// gets there--the <img src> swap then resolves instantly. Deferred to
// idle time so this doesn't compete with the page's own critical initial
// paint; requestIdleCallback isn't in Safari, hence the timeout fallback.
onMounted(() => {
  const rest = props.cardPreview?.slice(1)
  if (!rest?.length) return
  const warm = () => { rest.forEach((item) => { new Image().src = item.src }) }
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 2000 })
  else setTimeout(warm, 200)
})

function cardEl(): HTMLElement | null {
  // NuxtLink is a component, not a plain element--its template ref is
  // the component instance, and $el is the underlying <a> it renders.
  const instance = cardRef.value as unknown as { $el?: HTMLElement } | HTMLElement | null
  if (!instance) return null
  return '$el' in instance ? (instance.$el ?? null) : instance
}

// Ctrl/Cmd held means an in-progress (or about to start) graffiti stroke--
// the hover-preview cycling and the darken/scale below would otherwise
// fire right along with it, since the canvas has pointer-events:none and
// this card's own mousemove keeps receiving events underneath it. Keyed
// off graffiti.js's own 'graffiti-mode' body class rather than re-reading
// event.ctrlKey here, since that's the one already source-of-truth for
// "is a stroke live right now" (only set once the key's actually held on
// a desktop-with-a-real-keyboard viewport, see graffiti.js's own gating).
function isGraffitiDrawing() {
  return document.body.classList.contains('graffiti-mode')
}

function updateFromClientX(clientX: number) {
  const preview = props.cardPreview
  const el = cardEl()
  if (!preview?.length || !el || isGraffitiDrawing()) return
  const rect = el.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  activeIndex.value = Math.min(preview.length - 1, Math.floor(ratio * preview.length))
}

function onMouseMove(event: MouseEvent) {
  updateFromClientX(event.clientX)
}
function onMouseLeave() {
  activeIndex.value = null
}

// A touch drag starts ambiguous--could be a vertical page scroll or a
// horizontal "hover" swipe across the card. Wait for enough movement to
// tell them apart (a plain tap never moves far enough to trigger either),
// then commit to one for the rest of the gesture: horizontal drives the
// preview cycling below, vertical does nothing here and leaves the
// browser's own scroll alone--previously every touchmove cycled the
// preview regardless of direction, so scrolling down over a card also
// flashed through its preview images.
const touchStart = ref<{ x: number, y: number } | null>(null)
const touchIntent = ref<'pending' | 'horizontal' | 'vertical'>('pending')
const DIRECTION_THRESHOLD = 6 // px of movement before committing a direction

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) return
  touchStart.value = { x: touch.clientX, y: touch.clientY }
  touchIntent.value = 'pending'
}
function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch || !touchStart.value) return
  if (touchIntent.value === 'pending') {
    const dx = touch.clientX - touchStart.value.x
    const dy = touch.clientY - touchStart.value.y
    if (Math.abs(dx) < DIRECTION_THRESHOLD && Math.abs(dy) < DIRECTION_THRESHOLD) return
    touchIntent.value = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
  }
  if (touchIntent.value === 'horizontal') updateFromClientX(touch.clientX)
}
function onTouchEnd() {
  activeIndex.value = null
  touchStart.value = null
  touchIntent.value = 'pending'
}

const activePreview = computed(() => (props.cardPreview && activeIndex.value !== null) ? props.cardPreview[activeIndex.value] : null)
</script>

<template>
  <NuxtLink
    ref="cardRef"
    class="inhouse-card"
    :to="`/${section}/${slug}`"
    @mousemove="cardPreview?.length ? onMouseMove($event) : undefined"
    @mouseleave="cardPreview?.length ? onMouseLeave() : undefined"
    @touchstart="cardPreview?.length ? onTouchStart($event) : undefined"
    @touchmove="cardPreview?.length ? onTouchMove($event) : undefined"
    @touchend="cardPreview?.length ? onTouchEnd() : undefined"
  >
    <div class="inhouse-card__cover">
      <img
        class="inhouse-card__cover-img"
        width="1080"
        height="1440"
        :src="`/assets/${section}/${slug}/${slug}-card.webp`"
        :alt="title"
      />
      <div class="inhouse-card__noise" aria-hidden="true"></div>
      <img
        v-if="cardPreview?.length"
        class="inhouse-card__hover-preview"
        :class="{ 'is-visible': !!activePreview }"
        :width="activePreview?.width ?? cardPreview[0].width"
        :height="activePreview?.height ?? cardPreview[0].height"
        :src="(activePreview ?? cardPreview[0]).src"
        alt=""
        aria-hidden="true"
      />
    </div>
    <span class="inhouse-title">{{ title }}</span>
  </NuxtLink>
</template>

<style scoped>
/* Asymmetric easing: a fast start that eases into a soft finish
   (cubic-bezier(0.16,1,0.3,1), a common "ease-out-expo" curve) reads
   very differently depending on direction, so enter/exit each need
   their OWN duration set on the state they transition INTO--the base
   (non-hover) rule's transition governs leaving :hover (900ms, quicker
   to settle back), and the :hover rule's own transition governs
   entering it (1400ms, a longer, more deliberate approach). No scale
   anymore (removed per the user's own request)--darken only, via
   brightness, back from a brief detour through an opacity-based
   lighten (0.8) that the user also reverted; brightness(0.9) is the
   settled value. */
.inhouse-card__cover-img {
  transition: filter 900ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Suppressed while a graffiti stroke is live (body.graffiti-mode, see
   isGraffitiDrawing() above)--drawing over the grid shouldn't also darken
   whatever card happens to be under the cursor. */
body:not(.graffiti-mode) .inhouse-card:hover .inhouse-card__cover-img {
  filter: brightness(0.9);
  transition: filter 1400ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Subtle film-grain texture that fades in alongside the darken above--a
   flat feTurbulence noise field (no external asset, generated
   inline as a data URI) blended over the cover via mix-blend-mode, not
   a separate visible layer. Same asymmetric-easing/duration split as
   the cover image itself, so both settle together in each direction. */
.inhouse-card__noise {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  transition: opacity 900ms cubic-bezier(0.16, 1, 0.3, 1);
}
body:not(.graffiti-mode) .inhouse-card:hover .inhouse-card__noise {
  opacity: 0.3;
  transition: opacity 1400ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Centered over the cover at half the card's own size--.inhouse-card__cover
   already has overflow:hidden (styles.css), so no extra clipping needed
   here even though this sits well within its bounds anyway. */
.inhouse-card__hover-preview {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 50%;
  height: 50%;
  transform: translate(-50%, -50%);
  object-fit: cover;
  pointer-events: none;
  opacity: 0;
  transition: opacity 320ms ease;
}

.inhouse-card__hover-preview.is-visible {
  opacity: 1;
}
</style>
