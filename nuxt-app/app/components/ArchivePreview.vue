<script setup lang="ts">
import type { ArchiveFlatItem } from '~/utils/archiveTypes'

// Desktop lightbox for the Archive (Stage 2: single-image; Stage 3 adds
// this file's filmstrip mode for series). Only ever opens on desktop
// widths (>980px)--the static site's own isMobile() gate; tablet/phone
// get their own card overlay (ArchiveCardOverlay.vue, Stage 4).

// Controlled by index into the full flat catalog (not a resolved item
// object)--stepping needs to know "the next/previous position", and for a
// series, the CURRENT position within its own frame list too, which is
// simplest to derive from indices rather than juggling item references.
const props = defineProps<{ items: ArchiveFlatItem[], openIndex: number | null }>()
const emit = defineEmits<{ 'update:openIndex': [value: number | null] }>()

const overlay = useTemplateRef<HTMLElement>('overlay')
const previewImg = useTemplateRef<HTMLImageElement>('previewImg')
const previewHeader = useTemplateRef<HTMLElement>('previewHeader')
const previewText = useTemplateRef<HTMLElement>('previewText')
const previewTags = useTemplateRef<HTMLElement>('previewTags')
const previewInner = useTemplateRef<HTMLElement>('previewInner')
const filmstripEl = useTemplateRef<HTMLElement>('filmstripEl')
const frameEls = ref<(HTMLElement | null)[]>([])
const frameImgEls = ref<(HTMLImageElement | null)[]>([])

// [hidden]-equivalent (mount/unmount) vs the 'is-open' fade class--kept
// separate so closing can fade out over 260ms before actually unmounting,
// same as the static site's closePreview/closeHideTimer.
const isOpen = ref(false)
const isVisible = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined

const currentEntry = computed(() => props.openIndex !== null ? props.items[props.openIndex] ?? null : null)
const isGroupMode = computed(() => !!currentEntry.value?.group)
// A series' frames are always contiguous in `items` (mirrors the static
// site's own .archive-series-extra placement), so filtering preserves
// their real order--no separate sort needed.
const groupFrames = computed(() => isGroupMode.value ? props.items.filter(i => i.group === currentEntry.value!.group) : [])
const entryIndexInGroup = computed(() => currentEntry.value ? Math.max(0, groupFrames.value.indexOf(currentEntry.value)) : 0)
const frameDisplays = computed(() => groupFrames.value.map(frame => ({
  frame,
  titleParts: splitArchiveTitle(frame.frameTitle ?? frame.title),
  descParts: splitArchiveDescription(frame.description, frame.link),
})))

const isVertical = computed(() => !!currentEntry.value && currentEntry.value.height >= currentEntry.value.width)
const titleParts = computed(() => currentEntry.value ? splitArchiveTitle(currentEntry.value.frameTitle ?? currentEntry.value.title) : null)
const descParts = computed(() => currentEntry.value ? splitArchiveDescription(currentEntry.value.description, currentEntry.value.link) : null)

function isMobile() {
  return window.matchMedia('(max-width: 980px)').matches
}

// ── Single-image sizing (Stage 2) ──────────────────────────────────────
// Two passes, back-to-back: fitPreviewImage's own math depends on
// previewHeader/previewText's WIDTH, which the first pass itself just
// set--the second pass re-measures against that now-stable layout.
// Originally double-requestAnimationFrame'd (ported as-is from the
// static site), which silently broke inside the Archive open/close
// View Transition added later: that callback's own promise resolved
// right after img.decode(), well before either rAF had actually run,
// so the transition's "new" snapshot captured the UNSIZED, natural-size
// image--the mask then revealed that oversized/mispositioned layout
// before it visibly snapped to the correct one a frame later. Calling
// fitPreviewImage() synchronously twice works just as well: reading
// offsetHeight/clientHeight/getBoundingClientRect() always forces a
// synchronous layout recalculation against whatever was just written,
// no actual paint required--and now `await syncPreviewSize()` really
// does mean "sizing is done" wherever it's called, transition or not.
async function syncPreviewSize() {
  const img = previewImg.value
  if (!img) return
  if (img.decode) {
    try { await img.decode() } catch { /* a stale/aborted decode--the next syncPreviewSize call (new src) supersedes it */ }
  }
  fitPreviewImage()
  if (overlay.value && previewImg.value) overlay.value.style.setProperty('--preview-width', `${previewImg.value.getBoundingClientRect().width}px`)
  fitPreviewImage()
  if (overlay.value && previewImg.value) overlay.value.style.setProperty('--preview-width', `${previewImg.value.getBoundingClientRect().width}px`)
}

function fitPreviewImage() {
  const img = previewImg.value
  const ov = overlay.value
  const header = previewHeader.value
  const text = previewText.value
  const inner = previewInner.value
  if (!img || !ov || !header || !text || !inner) return
  const tagsH = (previewTags.value && currentEntry.value?.tags) ? previewTags.value.offsetHeight : 0

  if (isMobile()) {
    const availableHeight = ov.clientHeight - header.offsetHeight - text.offsetHeight - tagsH - 40
    const availableWidth = ov.clientWidth - 32
    const heightByWidth = availableWidth * (img.naturalHeight / img.naturalWidth)
    if (heightByWidth <= availableHeight) {
      img.style.width = '100%'
      img.style.height = 'auto'
      header.style.width = ''
      text.style.width = ''
      inner.style.alignItems = ''
    } else {
      const scaledWidth = availableHeight * (img.naturalWidth / img.naturalHeight)
      img.style.width = `${scaledWidth}px`
      img.style.height = `${availableHeight}px`
      header.style.width = `${scaledWidth}px`
      text.style.width = `${scaledWidth}px`
      inner.style.alignItems = 'flex-end'
    }
  } else {
    const availableHeight2 = ov.clientHeight - header.offsetHeight - text.offsetHeight - tagsH
    const availableWidth2 = ov.clientWidth - 16
    const heightByWidth2 = availableWidth2 * (img.naturalHeight / img.naturalWidth)
    const previewHeight = Math.min(availableHeight2, heightByWidth2)
    ov.style.setProperty('--preview-image-height', `${Math.max(0, previewHeight)}px`)
  }
}

// ── Filmstrip (Stage 3) ─────────────────────────────────────────────────
// Per-frame sizing: each frame's own natural size, capped only if it would
// overflow the filmstrip's available height (after that frame's own
// title/text/tags) or width--never upscaled. Frames end up uneven in
// height on purpose (they share a top line, not a common row height).
function fitFilmstripFrame(i: number) {
  const frame = frameEls.value[i]
  const img = frameImgEls.value[i]
  const strip = filmstripEl.value
  if (!frame || !img || !strip) return
  const naturalW = img.naturalWidth
  const naturalH = img.naturalHeight
  if (!naturalW || !naturalH) return
  const titleEl = frame.querySelector<HTMLElement>('.filmstrip-frame__title')
  const textEl = frame.querySelector<HTMLElement>('.filmstrip-frame__text')
  const tagsEl = frame.querySelector<HTMLElement>('.filmstrip-frame__tags')
  const availableWidth = strip.clientWidth - 32
  // Two passes: chromeH depends on titleEl/textEl's CURRENT offsetHeight,
  // which itself depends on the frame's CURRENT width (text wraps
  // differently at different widths)--this function is about to CHANGE
  // that width, so a single pass measures chromeH against a width that's
  // about to be stale. Computing once, applying it, then re-measuring
  // against the now-current layout is what actually converges--same
  // reasoning as syncPreviewSize's own two-pass fix, and the likely
  // cause of the reported "plaques randomly drift/overlap the photo by
  // a couple px" bug (whichever pass happened to run first landed on a
  // width that didn't match the text's real wrapped height).
  for (let pass = 0; pass < 2; pass++) {
    let chromeH = (titleEl?.offsetHeight ?? 0) + (textEl?.offsetHeight ?? 0)
    if (tagsEl) chromeH += tagsEl.offsetHeight
    const availableHeight = strip.clientHeight - chromeH
    let h = Math.min(naturalH, availableHeight)
    let w = h * (naturalW / naturalH)
    if (w > availableWidth) {
      w = availableWidth
      h = w * (naturalH / naturalW)
    }
    w = Math.round(w)
    h = Math.round(h)
    img.style.width = `${w}px`
    img.style.height = `${h}px`
    frame.style.width = `${w}px`
  }
}

function fitAllFilmstripFrames() {
  groupFrames.value.forEach((_, i) => fitFilmstripFrame(i))
}

function onFrameImgLoad(i: number) {
  fitFilmstripFrame(i)
}

async function openFilmstrip() {
  filmstripStepTarget = null
  frameEls.value = []
  frameImgEls.value = []
  await nextTick()
  // Size already-cached/complete frames BEFORE reading offsetLeft below--
  // same reasoning as syncPreviewSize's rAF removal: this used to run one
  // frame AFTER the scroll-set (via requestAnimationFrame), which broke
  // inside the Archive open View Transition (its own callback resolves
  // before that rAF ever fires, so the transition's "new" snapshot saw
  // the wrong scroll position). Reordered so both happen synchronously,
  // sizing first.
  groupFrames.value.forEach((_, i) => {
    const img = frameImgEls.value[i]
    if (img?.complete && img.naturalWidth) fitFilmstripFrame(i)
  })
  const idx = entryIndexInGroup.value
  if (idx <= 0) {
    if (filmstripEl.value) filmstripEl.value.scrollLeft = 0
  } else {
    const frame = frameEls.value[idx]
    if (filmstripEl.value && frame) filmstripEl.value.scrollLeft = frame.offsetLeft
  }
}

// ── Filmstrip drag/wheel/magnet interaction ─────────────────────────────
// scroll-snap-type would fight every instant scrollLeft write (drag/wheel
// ticks); easing + a magnet-on-settle replaces it so motion stays smooth
// under a live gesture and still snaps to a frame at rest.
let filmstripDragActive = false
let filmstripDragMoved = false
let filmstripDragStartX = 0
let filmstripDragStartScroll = 0
// Last frame index requested via stepPreview (keyboard/edge-click), so a
// rapid repeat step chains off the intended target instead of re-reading
// scrollLeft mid-flight. Invalidated by drag/wheel, which move the strip
// by a different mechanism and make this tracked value stale.
let filmstripStepTarget: number | null = null
let filmstripAnimRaf: number | null = null
let filmstripAnimTarget = 0
const FILMSTRIP_MAGNET_RADIUS = 48

function filmstripStopEase() {
  if (filmstripAnimRaf) {
    cancelAnimationFrame(filmstripAnimRaf)
    filmstripAnimRaf = null
  }
}

function filmstripEaseTo(target: number) {
  const strip = filmstripEl.value
  if (!strip) return
  const max = Math.max(0, strip.scrollWidth - strip.clientWidth)
  filmstripAnimTarget = Math.max(0, Math.min(max, target))
  if (filmstripAnimRaf) return
  const tick = () => {
    const s = filmstripEl.value
    if (!s) { filmstripAnimRaf = null; return }
    const current = s.scrollLeft
    const diff = filmstripAnimTarget - current
    if (Math.abs(diff) < 0.5) {
      s.scrollLeft = filmstripAnimTarget
      filmstripAnimRaf = null
      filmstripMagnetCheck()
      return
    }
    s.scrollLeft = current + diff * 0.22
    filmstripAnimRaf = requestAnimationFrame(tick)
  }
  filmstripAnimRaf = requestAnimationFrame(tick)
}

function filmstripMagnetCheck() {
  const strip = filmstripEl.value
  if (!strip || !groupFrames.value.length || filmstripDragActive) return
  const scrollLeft = strip.scrollLeft
  const max = Math.max(0, strip.scrollWidth - strip.clientWidth)
  let nearest: number | null = null
  let nearestDist = Infinity
  frameEls.value.forEach((el) => {
    if (!el) return
    const d = Math.abs(el.offsetLeft - scrollLeft)
    if (d < nearestDist) { nearestDist = d; nearest = el.offsetLeft }
  })
  if (Math.abs(max - scrollLeft) < nearestDist) { nearestDist = Math.abs(max - scrollLeft); nearest = max }
  if (nearest !== null && nearestDist > 1 && nearestDist <= FILMSTRIP_MAGNET_RADIUS) {
    filmstripEaseTo(nearest)
  }
}

function currentFilmstripIndex(): number {
  const strip = filmstripEl.value
  if (!strip) return 0
  const scrollLeft = strip.scrollLeft
  const max = Math.max(0, strip.scrollWidth - strip.clientWidth)
  if (scrollLeft >= max - 1) return groupFrames.value.length - 1
  let idx = 0
  frameEls.value.forEach((el, i) => {
    if (el && el.offsetLeft <= scrollLeft + 8) idx = i
  })
  return idx
}

function stepFilmstrip(dir: 1 | -1) {
  if (!groupFrames.value.length) return
  filmstripStopEase()
  const idx = filmstripStepTarget !== null ? filmstripStepTarget : currentFilmstripIndex()
  const next = Math.max(0, Math.min(groupFrames.value.length - 1, idx + dir))
  filmstripStepTarget = next
  const strip = filmstripEl.value
  const frame = frameEls.value[next]
  if (strip && frame) strip.scrollTo({ left: frame.offsetLeft, behavior: 'smooth' })
}

function onFilmstripPointerDown(event: PointerEvent) {
  filmstripStopEase()
  filmstripStepTarget = null
  filmstripDragActive = true
  filmstripDragMoved = false
  filmstripDragStartX = event.clientX
  filmstripDragStartScroll = filmstripEl.value?.scrollLeft ?? 0
  filmstripEl.value?.classList.add('is-dragging')
  try { filmstripEl.value?.setPointerCapture(event.pointerId) } catch { /* pointer already released--nothing to capture */ }
}
function onFilmstripPointerMove(event: PointerEvent) {
  if (!filmstripDragActive || !filmstripEl.value) return
  const dx = event.clientX - filmstripDragStartX
  if (Math.abs(dx) > 4) filmstripDragMoved = true
  filmstripEl.value.scrollLeft = filmstripDragStartScroll - dx
}
function endFilmstripDrag() {
  if (!filmstripDragActive) return
  filmstripDragActive = false
  filmstripEl.value?.classList.remove('is-dragging')
  filmstripMagnetCheck()
  // Clear the "was a drag" flag after this gesture's own click event has
  // had a chance to consume it (see onOverlayClick's guard)--clearing it
  // synchronously here would leave it stale for the next, unrelated click.
  setTimeout(() => { filmstripDragMoved = false }, 0)
}
function onFilmstripWheel(event: WheelEvent) {
  if (event.ctrlKey) return // trackpad pinch-to-zoom--leave that to the browser
  const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
  if (!delta) return
  event.preventDefault()
  filmstripStepTarget = null
  const base = filmstripAnimRaf ? filmstripAnimTarget : (filmstripEl.value?.scrollLeft ?? 0)
  filmstripEaseTo(base + delta)
}

function handleEdgeClick(dir: 1 | -1, event: MouseEvent) {
  if (filmstripDragMoved) return // was a drag, not a tap
  event.stopPropagation()
  stepPreview(dir)
}

// .preview-nav's click needs the same stopPropagation handleEdgeClick
// already has--without it, the click bubbles to the overlay's own
// onOverlayClick, which (in group mode) closes on anything that isn't
// on its allow-list. That allow-list never included `.preview-nav`
// (it's hidden in group mode anyway), so a step that LANDS on a
// group's first/last frame flips isGroupMode mid-click and the same
// click that just requested the step closes the whole lightbox instead.
function handleNavClick(dir: 1 | -1, event: MouseEvent) {
  event.stopPropagation()
  stepPreview(dir)
}

// ── Shared prev/next navigation ──────────────────────────────────────
// Inside an open filmstrip, stepping past its first/last frame keeps
// going straight into the previous/next item of the whole flat catalog
// (a series' frames are always contiguous in `items`), so "last frame of
// the filmstrip" never reads as a dead end. Outside a filmstrip it's a
// direct catalog-to-catalog jump--no scroll/ease, that's filmstrip-only.
function stepPreview(dir: 1 | -1) {
  // Blur whatever's focused (typically a just-clicked .preview-nav
  // button) on every step, not just the very first open--otherwise a
  // mouse-clicked nav button keeps its focus ring visible through every
  // later keyboard-driven step too, since nothing else ever clears it.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  if (isGroupMode.value) {
    const frameIdx = currentFilmstripIndex()
    const nextFrameIdx = frameIdx + dir
    if (nextFrameIdx >= 0 && nextFrameIdx < groupFrames.value.length) {
      stepFilmstrip(dir)
      return
    }
    const globalIdx = props.items.indexOf(groupFrames.value[frameIdx]!)
    if (globalIdx === -1) return
    const nextGlobalIdx = (globalIdx + dir + props.items.length) % props.items.length
    emit('update:openIndex', nextGlobalIdx)
    return
  }
  if (!currentEntry.value) return
  const flatIdx = props.items.indexOf(currentEntry.value)
  if (flatIdx === -1) return
  const nextFlatIdx = (flatIdx + dir + props.items.length) % props.items.length
  emit('update:openIndex', nextFlatIdx)
}

// A step between two single-image cards (not the filmstrip's own scroll
// physics, which already reads as smooth) gets a brief opacity/scale
// crossfade on the swapped image--cheap and self-contained, per the
// user's "смягчить" ask. Only for genuine steps (!wasClosed), never the
// initial open (that already has its own is-open fade).
const isStepping = ref(false)

// Mount/unmount (not the step-to-step crossfade above) gets a mask
// that wipes down from the top to reveal the lightbox, and the reverse
// to hide it on close--"шторкой сверху, как маской" per the user's own
// description. Deliberately a PLAIN CSS clip-path transition on its own
// overlay element (.archive-preview__shutter), not the native View
// Transitions API: that approach (tried first) ties the mask's timing
// to a browser-captured snapshot, and Archive's own sizing
// (syncPreviewSize/openFilmstrip) has async steps whose completion the
// browser's transition callback doesn't reliably wait for--the mask
// ended up revealing content before it was correctly sized. A shutter
// element sidesteps that entirely: content gets mounted and sized on
// whatever schedule it needs to, in full, BEFORE the shutter is ever
// told to retract--so there's nothing for it to reveal but the already-
// correct layout. Pattern matches the user's own reference
// (House of Walk's shutter/curtain), same clip-path direction.
const shutterCovering = ref(true)
// Invalidates a pending close's delayed unmount if the user reopens
// before that unmount actually runs--without this, a fast
// close-then-reopen could have the stale close still unmount the
// freshly-reopened lightbox out from under it.
let transitionToken = 0
const SHUTTER_MS = 600

// ── Open/close ───────────────────────────────────────────────────────
watch(() => props.openIndex, async (idx) => {
  if (idx === null) return
  const wasClosed = !isOpen.value
  const token = ++transitionToken

  if (wasClosed) {
    shutterCovering.value = true
    isOpen.value = true
    isVisible.value = true
    document.body.classList.add('is-preview-open')
    await nextTick()
    if (isGroupMode.value) await openFilmstrip()
    else await syncPreviewSize()
    if (token !== transitionToken) return // superseded mid-transition (rapid open/close)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    // Content is now fully sized--safe to retract the shutter. Double
    // rAF (not one): the "covering" state needs to actually paint
    // before flipping the class, or the browser can coalesce both
    // style changes into a single frame and skip the transition
    // entirely, same reasoning as loadMore()'s own "two frames, not
    // one" reveal elsewhere in this file.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token === transitionToken) shutterCovering.value = false
      })
    })
    return
  }

  // Switching to a different already-open card: no mount transition,
  // just the existing crossfade (single image) or scroll (filmstrip).
  window.clearGraffiti?.()
  if (!isGroupMode.value) isStepping.value = true
  isOpen.value = true
  document.body.classList.add('is-preview-open')
  // Let Vue actually apply the new item to the DOM before measuring/
  // decoding anything below--reading it in the same synchronous tick
  // would still see the previous element state.
  await nextTick()
  if (isGroupMode.value) {
    await openFilmstrip()
  } else {
    await syncPreviewSize()
    requestAnimationFrame(() => { isStepping.value = false })
  }
})

function close() {
  const token = ++transitionToken
  document.body.classList.remove('is-preview-open')
  // Closing goes back to the Archive section itself--the graffiti drawn
  // while this card was open shouldn't linger there.
  window.clearGraffiti?.()
  filmstripStopEase()
  clearTimeout(closeTimer)
  // Cover first (reverse of the open reveal--same clip-path property,
  // so the browser just plays the transition backward), THEN unmount
  // once it's fully hidden behind the shutter--no visible pop from the
  // content disappearing, since nothing of it is showing by then.
  shutterCovering.value = true
  closeTimer = setTimeout(() => {
    if (token !== transitionToken) return // a reopen already happened, don't unmount it
    isVisible.value = false
    isOpen.value = false
    overlay.value?.style.removeProperty('--preview-width')
    overlay.value?.style.removeProperty('--preview-image-height')
    if (previewImg.value) { previewImg.value.style.width = ''; previewImg.value.style.height = '' }
    if (previewHeader.value) previewHeader.value.style.width = ''
    if (previewText.value) previewText.value.style.width = ''
    if (previewInner.value) previewInner.value.style.alignItems = ''
  }, SHUTTER_MS)
  emit('update:openIndex', null)
}

function onOverlayClick(event: MouseEvent) {
  // A graffiti stroke's mouseup fires a click too--the canvas itself has
  // pointer-events:none (paint is routed by rectangle membership, not
  // real hit-testing), so that click's target ends up being whatever's
  // underneath the cursor. Ctrl/Cmd is only ever held for drawing, never
  // for an intentional close-click, so bail before the target checks
  // below can mistake a drawn stroke for a click-outside-to-close.
  if (event.ctrlKey || event.metaKey) return
  const target = event.target as HTMLElement
  if (isGroupMode.value) {
    if (target.closest('.preview-close')) { close(); return }
    if (filmstripDragMoved) return
    if (target.closest('.filmstrip-frame')) return
    if (target.closest('.filmstrip-edge')) return
    close()
    return
  }
  if (!previewInner.value?.contains(target)) close()
}

function onResize() {
  if (!isOpen.value) return
  if (isGroupMode.value) {
    fitAllFilmstripFrames()
    return
  }
  fitPreviewImage()
  if (overlay.value && previewImg.value) overlay.value.style.setProperty('--preview-width', `${previewImg.value.getBoundingClientRect().width}px`)
  fitPreviewImage()
  if (overlay.value && previewImg.value) overlay.value.style.setProperty('--preview-width', `${previewImg.value.getBoundingClientRect().width}px`)
}

function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value || isMobile()) return
  if (event.key === 'Escape') { close(); return }
  // Space is deliberately NOT wired to stepping here--it's the
  // graffiti feature's global clear-tag key (see graffiti.js), and
  // having it do both depending on focus was a real conflict. Arrow
  // keys are the only keyboard way to step through the lightbox now.
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  stepPreview(event.key === 'ArrowRight' ? 1 : -1)
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('is-preview-open')
  filmstripStopEase()
  clearTimeout(closeTimer)
})
</script>

<template>
  <div
    v-if="isOpen"
    ref="overlay"
    class="archive-preview"
    :class="{ 'is-open': isVisible, 'is-filmstrip': isGroupMode, 'is-vertical': !isGroupMode && isVertical, 'is-horizontal': !isGroupMode && !isVertical }"
    @click="onOverlayClick"
  >
    <button class="close-button preview-close" type="button" @click="close"><span>[X]</span></button>
    <div class="archive-preview__shutter" :class="{ 'is-covering': shutterCovering }" aria-hidden="true"></div>

    <div v-if="!isGroupMode" ref="previewInner" class="archive-preview__inner">
      <header ref="previewHeader" class="content-pane__header project-header">
        <h1 class="preview-title">{{ titleParts?.base }}<sup v-if="titleParts?.badge" class="archive-num">{{ titleParts.badge }}</sup></h1>
      </header>
      <div class="preview-media">
        <img ref="previewImg" class="preview-image" :class="{ 'is-stepping': isStepping }" :src="currentEntry?.src" :alt="currentEntry?.alt || ''" />
        <button class="preview-nav preview-nav--prev" type="button" aria-label="Previous photo" @click="handleNavClick(-1, $event)"><span class="preview-nav__arrow">&lt;</span></button>
        <button class="preview-nav preview-nav--next" type="button" aria-label="Next photo" @click="handleNavClick(1, $event)"><span class="preview-nav__arrow">&gt;</span></button>
      </div>
      <div ref="previewText" class="preview-text">
        <p v-if="descParts">{{ descParts.before }}<a class="archive-num" :href="currentEntry!.link" target="_blank" rel="noreferrer">{{ descParts.linkText }}</a>{{ descParts.after }}</p>
        <p v-else>{{ currentEntry?.description }}</p>
      </div>
      <span v-if="currentEntry?.tags" ref="previewTags" class="preview-tags">{{ currentEntry.tags }}</span>
    </div>

    <template v-else>
      <div
        ref="filmstripEl"
        class="archive-preview__filmstrip"
        @pointerdown="onFilmstripPointerDown"
        @pointermove="onFilmstripPointerMove"
        @pointerup="endFilmstripDrag"
        @pointercancel="endFilmstripDrag"
        @wheel="onFilmstripWheel"
      >
        <div
          v-for="(display, i) in frameDisplays"
          :key="display.frame.src"
          class="filmstrip-frame"
          :ref="(el) => { frameEls[i] = el as HTMLElement | null }"
        >
          <h2 class="filmstrip-frame__title">{{ display.titleParts.base }}<sup v-if="display.titleParts.badge" class="archive-num">{{ display.titleParts.badge }}</sup></h2>
          <div class="filmstrip-frame__media">
            <img
              :ref="(el) => { frameImgEls[i] = el as HTMLImageElement | null }"
              :width="display.frame.width"
              :height="display.frame.height"
              :src="display.frame.src"
              :alt="display.frame.alt"
              :draggable="false"
              @load="onFrameImgLoad(i)"
            />
          </div>
          <div class="filmstrip-frame__text">
            <p v-if="display.descParts">{{ display.descParts.before }}<a class="archive-num" :href="display.frame.link" target="_blank" rel="noreferrer">{{ display.descParts.linkText }}</a>{{ display.descParts.after }}</p>
            <p v-else>{{ display.frame.description }}</p>
          </div>
          <span v-if="display.frame.tags" class="filmstrip-frame__tags">{{ display.frame.tags }}</span>
        </div>
      </div>
      <div class="filmstrip-edge filmstrip-edge--left" aria-hidden="true" @click="handleEdgeClick(-1, $event)">
        <span class="filmstrip-edge__arrow">&lt;</span>
      </div>
      <div class="filmstrip-edge filmstrip-edge--right" aria-hidden="true" @click="handleEdgeClick(1, $event)">
        <span class="filmstrip-edge__arrow">&gt;</span>
      </div>
    </template>
  </div>
</template>
