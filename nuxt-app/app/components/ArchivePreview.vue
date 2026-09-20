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

// close() emits update:openIndex(null) immediately (not after the mask
// finishes)--so props.openIndex goes null well before the 800ms clip-
// path retreat has actually hidden anything. Reading it directly here
// meant currentEntry (and everything derived from it: the image src,
// title, description, tags, even isGroupMode) went blank/false the
// INSTANT close() ran, while the mask was still supposed to be
// gracefully covering a card that, by then, had no content left to
// show--read live as the card "snapping" empty immediately, then the
// shell finishing its retreat a beat later. Falling back to the last
// real index while openIndex is null keeps rendering the card that was
// actually open throughout the whole retreat; nothing about it changes
// until isOpen itself goes false (the existing MASK_MS-delayed unmount
// in close()), which is also when this stale index stops mattering.
const lastOpenIndex = ref<number | null>(null)
watch(() => props.openIndex, (idx) => { if (idx !== null) lastOpenIndex.value = idx })
const currentEntry = computed(() => {
  const idx = props.openIndex ?? lastOpenIndex.value
  return idx !== null ? props.items[idx] ?? null : null
})
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
// Re-measures the rendered width available to the photo and republishes
// it as --preview-width (which the title/description/tags plaques size
// themselves to--see the CSS comment on .archive-preview__inner's
// children), looping fitPreviewImage() until that measurement stops
// moving (capped, as a safety net against a pathological case never
// settling). A fixed two passes (the previous approach) assumes the
// SECOND pass's resulting width is already final, but that isn't always
// true: header's own height is fixed (18px) regardless of width, but
// preview-text's description wraps onto a different number of lines
// right around certain widths, which changes its offsetHeight, which
// changes the available height fitPreviewImage() gives the photo, which
// changes the photo's own width--sometimes still mid-settle after only
// two rounds.
//
// Measures the <img>'s own offsetWidth, NOT getBoundingClientRect()--the
// real bug behind the plaques reading persistently narrower than the
// photo after every card-to-card step (not just a one-frame flash):
// this runs while isStepping is still true, i.e. while the swapped-in
// <img> still carries the is-stepping CSS class's `transform:
// scale(0.98)`. A transform never changes an element's own LAYOUT size,
// but it DOES change what getBoundingClientRect() reports for that
// element specifically (the post-transform, painted box)--so measuring
// the <img> that way read a width scaled down by that same 0.98 factor
// (confirmed live: a 589.47px photo measured as 577.68px, exactly
// 589.47*0.98), and that wrong, ~2%-too-narrow number got baked into
// --preview-width for the plaques, staying wrong until the NEXT step
// re-measured (and re-corrupted) it the same way. offsetWidth is a pure
// LAYOUT measurement (no transform applied), so it isn't affected.
//
// Also deliberately NOT .preview-media's own rect, which would dodge
// the transform issue too but trades it for a worse one: .preview-media
// has no width of its own--it flex-stretches to match whichever sibling
// (header/text/tags, all explicitly `width: var(--preview-width)`) is
// widest, so its rect is partly a REFLECTION of the very value we're
// about to overwrite, not independent ground truth. Measuring it after
// a filmstrip visit (which never touches --preview-width, so it can
// hold a stale value from a completely different, differently-sized
// photo the whole time the series was open) just fed that stale number
// back to itself forever, converging to "whatever it already was"
// instead of the new photo's real size (confirmed live: header and
// .preview-media agreed with each other after stepping out of
// Transportation's filmstrip, but the actual <img> rendered ~2px
// narrower than both--neither plaque nor container had course-corrected
// to the new photo at all). The <img>'s own offsetWidth has no such
// dependency: its width is computed straight from its own natural
// aspect ratio and the height fitPreviewImage() just gave it, with no
// path back through --preview-width.
//
// Originally double-requestAnimationFrame'd (ported as-is from the
// static site), which silently broke inside the Archive open/close
// View Transition added later: that callback's own promise resolved
// right after img.decode(), well before either rAF had actually run,
// so the transition's "new" snapshot captured the UNSIZED, natural-size
// image--the mask then revealed that oversized/mispositioned layout
// before it visibly snapped to the correct one a frame later. Calling
// fitPreviewImage() synchronously works just as well: reading
// offsetHeight/clientHeight/getBoundingClientRect() always forces a
// synchronous layout recalculation against whatever was just written,
// no actual paint required.
function syncPreviewWidth() {
  const img = previewImg.value
  const ov = overlay.value
  if (!img || !ov) return
  let lastWidth = -1
  for (let i = 0; i < 6; i++) {
    fitPreviewImage()
    const width = img.offsetWidth
    ov.style.setProperty('--preview-width', `${width}px`)
    if (Math.abs(width - lastWidth) < 0.05) return
    lastWidth = width
  }
}

async function syncPreviewSize() {
  const img = previewImg.value
  if (!img) return
  // Was img.decode()--switched after finding it can simply never settle
  // (neither resolve nor reject, hanging this whole step forever in the
  // faded is-stepping state) for an <img> whose src is already cached/
  // decoded elsewhere on the page, which is exactly our situation: the
  // grid thumbnail and the lightbox's own <img> are two different
  // elements pointing at the same url, and the lightbox one is freshly
  // (re)mounted on every filmstrip<->single-image crossing. complete/
  // load has none of decode()'s edge cases here--naturalWidth/Height
  // (all the sizing math below actually needs) are guaranteed available
  // by the time either fires, and isStepping's own opacity fade already
  // gives the browser a real paint's worth of time to finish decoding
  // before the image is ever actually revealed.
  if (!img.complete) {
    await new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true })
      img.addEventListener('error', () => resolve(), { once: true })
    })
  }
  syncPreviewWidth()
}

function fitPreviewImage() {
  const img = previewImg.value
  const ov = overlay.value
  const header = previewHeader.value
  const text = previewText.value
  const inner = previewInner.value
  if (!img || !ov || !header || !text || !inner) return
  const tagsH = (previewTags.value && currentEntry.value?.tags) ? previewTags.value.offsetHeight : 0

  // Crossing the mobile/desktop breakpoint WHILE the lightbox stays open
  // (e.g. docking/undocking Chrome DevTools, which easily pushes the
  // viewport under 980px and back without the lightbox ever closing)
  // used to leave stale inline styles behind: the mobile branch below
  // sets fixed-px inline styles (outranking any stylesheet rule by
  // specificity), but the desktop branch only ever wrote the
  // --preview-image-height/--preview-width CSS custom properties--it
  // never cleared those inline overrides, so once a single mobile-width
  // pass had run, the photo stayed stuck at that fixed px size forever
  // after, visibly squished/wrong-proportioned even back at full desktop
  // width, and stayed that way through every later card (switching
  // cards re-runs this function, but the desktop branch still never
  // touched the leftover inline styles--only close() ever cleared them).
  // Clearing unconditionally here means whichever branch runs below
  // always starts from a clean slate.
  img.style.width = ''
  img.style.height = ''
  header.style.width = ''
  text.style.width = ''
  inner.style.alignItems = ''

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

// Mount/unmount (not the step-to-step crossfade above) gets a mask:
// the lightbox's OWN content clips away upward into a slot at the top,
// unclipping the ACTUAL archive grid underneath (already there the
// whole time, just dimmed via body.is-preview-open) instead of a
// separate opaque panel covering it. Per the user's own correction:
// a separate white shutter read as "an unwanted white curtain"; what
// they wanted is the card itself sliding up into a mask, revealing the
// real section at full opacity as it goes--so this clips
// .archive-preview directly (clip-path, not the native View
// Transitions API--that approach, tried first, ties the mask's timing
// to a browser-captured snapshot, and Archive's own sizing
// (syncPreviewSize/openFilmstrip) has async steps whose completion the
// transition callback doesn't reliably wait for, revealing content
// before it was correctly sized).
//
// isVisible drives the clip: default (mounted, not yet revealed) is
// clipped to a zero-height sliver anchored at the TOP (bottom-inset
// 100%)--as it opens, the bottom-inset shrinks toward 0, so the
// visible box grows DOWNWARD from that top anchor (content "slides
// down out of a slot at the top"). Closing reverses the exact same
// property back to the sliver, which reads as the content retreating
// back UP into that same slot--exactly the reverse motion, no separate
// keyframes needed for either direction.
// Invalidates a pending close's delayed unmount if the user reopens
// before that unmount actually runs--without this, a fast
// close-then-reopen could have the stale close still unmount the
// freshly-reopened lightbox out from under it.
let transitionToken = 0
const MASK_MS = 800

// ── Open/close ───────────────────────────────────────────────────────
watch(() => props.openIndex, async (idx) => {
  if (idx === null) return
  const wasClosed = !isOpen.value
  const token = ++transitionToken

  if (wasClosed) {
    isOpen.value = true
    // isVisible stays false here--the freshly-mounted element starts
    // clipped to the top sliver, revealed only once sizing below
    // finishes (see the double-rAF further down for why the reveal
    // itself is deferred, not just the mount).
    document.body.classList.add('is-preview-open')
    await nextTick()
    if (isGroupMode.value) await openFilmstrip()
    else await syncPreviewSize()
    if (token !== transitionToken) return // superseded mid-transition (rapid open/close)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    // Content is now fully sized--safe to reveal. Double rAF (not
    // one): the clipped/hidden state needs to actually paint before
    // flipping the class, or the browser can coalesce both style
    // changes into a single frame and skip the transition entirely,
    // same reasoning as loadMore()'s own "two frames, not one" reveal
    // elsewhere in this file.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token === transitionToken) isVisible.value = true
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
    // Force a synchronous style/layout flush of the current
    // (is-stepping) state before clearing it--reading a layout
    // property does this immediately, guaranteed. The previous
    // requestAnimationFrame() here could be delayed by an arbitrary
    // amount of other work (this same tick's own decode/measure work
    // included), during which the image was stuck showing its faded/
    // shrunk starting state--read live as the plaques and photo
    // randomly drifting right after stepping out of a filmstrip
    // series into the next single-image card, since THAT crossing
    // does the most work (a fresh .archive-preview__inner mount) and
    // so was the likeliest to push the rAF back far enough to notice.
    previewImg.value?.offsetHeight
    isStepping.value = false
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
  // Retreat first (reverse of the open reveal--same clip-path property,
  // so the browser just plays the transition backward, the content
  // clipping back up into the top slot), THEN unmount once it's fully
  // clipped away--no visible pop from the content disappearing, since
  // nothing of it is showing by then. The archive grid underneath
  // (already there, just dimmed via body.is-preview-open, removed
  // above) fades back to full opacity on its own 0.3s transition,
  // visible through the shrinking clip the whole time.
  isVisible.value = false
  closeTimer = setTimeout(() => {
    if (token !== transitionToken) return // a reopen already happened, don't unmount it
    isOpen.value = false
    overlay.value?.style.removeProperty('--preview-width')
    overlay.value?.style.removeProperty('--preview-image-height')
    if (previewImg.value) { previewImg.value.style.width = ''; previewImg.value.style.height = '' }
    if (previewHeader.value) previewHeader.value.style.width = ''
    if (previewText.value) previewText.value.style.width = ''
    if (previewInner.value) previewInner.value.style.alignItems = ''
  }, MASK_MS)
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
    // Every frame's own width (and so its offsetLeft) depends on the
    // filmstrip's current clientWidth--resizing the window changes all
    // of them, which can shrink the filmstrip's total scrollWidth below
    // the (still pre-resize) scrollLeft. Left alone, the browser then
    // clamps scrollLeft down on its own once fitAllFilmstripFrames()
    // narrows everything, which visibly snapped the view back toward
    // frame 0 instead of keeping whatever frame was actually being
    // viewed. Recording which frame that was BEFORE resizing (while
    // scrollLeft/offsetLeft still reflect the old, correct layout) and
    // scrolling back to that same frame's new offsetLeft afterward is
    // what actually keeps the view stable across a resize.
    const idx = currentFilmstripIndex()
    fitAllFilmstripFrames()
    const frame = frameEls.value[idx]
    if (filmstripEl.value && frame) filmstripEl.value.scrollLeft = frame.offsetLeft
    return
  }
  syncPreviewWidth()
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

    <div v-if="!isGroupMode" ref="previewInner" class="archive-preview__inner" :class="{ 'is-stepping': isStepping }">
      <header ref="previewHeader" class="content-pane__header project-header">
        <h1 class="preview-title">{{ titleParts?.base }}<sup v-if="titleParts?.badge" class="archive-num">{{ titleParts.badge }}</sup></h1>
      </header>
      <div class="preview-media">
        <img ref="previewImg" class="preview-image" :src="currentEntry?.src" :alt="currentEntry?.alt || ''" />
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
