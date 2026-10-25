// Touch gestures on a photo (phones/tablets), both Instagram-style--nothing
// is left changed once the fingers lift:
//   - two-finger pinch: a clone of the photo floats above the page, scaled
//     and dragged with the fingers (the original stays put underneath, so
//     the pane/figure that clips it can't cut the zoom off), then eases
//     back to its original size on release;
//   - long-press (~0.45s, one finger, no movement): a square loupe above
//     the finger magnifies the spot under it for as long as it's held.
// Touch events, not pointer events: once the browser starts a pan it
// cancels the pointer stream, which would kill a pinch mid-gesture, while
// touchmove keeps flowing and can be preventDefault()ed.

const MAX_SCALE = 5
const LOUPE_SIZE = 132
const LOUPE_ZOOM = 2.5
const LOUPE_DELAY_MS = 450
const LOUPE_MOVE_CANCEL_PX = 10
const RETURN_MS = 420
const RETURN_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const LAYER_Z = 300

function distance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function makeLayer() {
  const layer = document.createElement('div')
  Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: String(LAYER_Z), pointerEvents: 'none' })
  document.body.appendChild(layer)
  return layer
}

// Same box, crop and source as the live photo, so a cover-cropped photo
// magnifies exactly the part that's actually visible.
function makeClone(img: HTMLImageElement, rect: DOMRect) {
  const cs = getComputedStyle(img)
  const clone = document.createElement('img')
  clone.src = img.currentSrc || img.src
  clone.alt = ''
  clone.decoding = 'sync'
  Object.assign(clone.style, {
    position: 'absolute',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    maxWidth: 'none',
    margin: '0',
    display: 'block',
    objectFit: cs.objectFit,
    objectPosition: cs.objectPosition,
    transformOrigin: '0 0',
    willChange: 'transform',
  })
  return clone
}

export function attachPinchZoom(img: HTMLImageElement): () => void {
  if (!(navigator.maxTouchPoints > 0 || 'ontouchstart' in window)) return () => {}

  type Mode = 'idle' | 'pending' | 'pinch' | 'loupe' | 'spent'
  let mode: Mode = 'idle'
  let returning = false
  let lastTouchAt = 0

  let rect: DOMRect | null = null
  let layer: HTMLElement | null = null
  let backdrop: HTMLElement | null = null
  let clone: HTMLImageElement | null = null
  let lens: HTMLElement | null = null
  let lensImg: HTMLImageElement | null = null

  let startDist = 1
  let startCx = 0
  let startCy = 0
  let rafId = 0
  let longPressTimer: ReturnType<typeof setTimeout> | undefined
  let returnTimer: ReturnType<typeof setTimeout> | undefined
  let pressX = 0
  let pressY = 0

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // The browser's own zoom/double-tap-zoom and image callout/selection
  // would all race these gestures.
  img.style.touchAction = 'pan-x pan-y'
  img.style.setProperty('-webkit-touch-callout', 'none')
  img.style.userSelect = 'none'

  function cleanup() {
    cancelAnimationFrame(rafId)
    clearTimeout(returnTimer)
    layer?.remove()
    layer = backdrop = clone = lens = lensImg = null
    img.style.visibility = ''
    returning = false
  }

  function startPinch(a: Touch, b: Touch) {
    rect = img.getBoundingClientRect()
    layer = makeLayer()
    backdrop = document.createElement('div')
    Object.assign(backdrop.style, { position: 'absolute', inset: '0', background: '#F5F4F4', opacity: '0' })
    clone = makeClone(img, rect)
    layer.append(backdrop, clone)
    img.style.visibility = 'hidden'
    startDist = Math.max(distance(a, b), 1)
    startCx = (a.clientX + b.clientX) / 2
    startCy = (a.clientY + b.clientY) / 2
    mode = 'pinch'
  }

  function updatePinch(a: Touch, b: Touch) {
    if (!rect || !clone || !backdrop) return
    const scale = Math.min(MAX_SCALE, Math.max(1, distance(a, b) / startDist))
    const cx = (a.clientX + b.clientX) / 2
    const cy = (a.clientY + b.clientY) / 2
    // Keeps the point that started under the fingers' midpoint under it.
    const tx = cx - startCx + (1 - scale) * (startCx - rect.left)
    const ty = cy - startCy + (1 - scale) * (startCy - rect.top)
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      if (!clone || !backdrop) return
      clone.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`
      backdrop.style.opacity = String(Math.min(0.92, (scale - 1) * 0.5))
    })
  }

  function endPinch() {
    if (!clone || !backdrop) { cleanup(); return }
    returning = true
    cancelAnimationFrame(rafId)
    if (reducedMotion()) { cleanup(); return }
    clone.style.transition = `transform ${RETURN_MS}ms ${RETURN_EASE}`
    backdrop.style.transition = `opacity ${RETURN_MS}ms ${RETURN_EASE}`
    // Flush the live transform first so the transition starts from it.
    void clone.getBoundingClientRect()
    clone.style.transform = 'translate3d(0, 0, 0) scale(1)'
    backdrop.style.opacity = '0'
    returnTimer = setTimeout(cleanup, RETURN_MS + 40)
  }

  function updateLoupe(x: number, y: number) {
    if (!rect || !lens || !lensImg) return
    const px = Math.min(rect.width, Math.max(0, x - rect.left))
    const py = Math.min(rect.height, Math.max(0, y - rect.top))
    lensImg.style.transform = `translate(${LOUPE_SIZE / 2 - LOUPE_ZOOM * px}px, ${LOUPE_SIZE / 2 - LOUPE_ZOOM * py}px) scale(${LOUPE_ZOOM})`
    const left = Math.min(window.innerWidth - LOUPE_SIZE - 8, Math.max(8, x - LOUPE_SIZE / 2))
    // Above the finger so it isn't covered; below it when there's no room.
    const above = y - LOUPE_SIZE - 28
    lens.style.left = `${left}px`
    lens.style.top = `${above >= 8 ? above : y + 28}px`
  }

  function startLoupe() {
    rect = img.getBoundingClientRect()
    layer = makeLayer()
    lens = document.createElement('div')
    Object.assign(lens.style, {
      position: 'absolute',
      width: `${LOUPE_SIZE}px`,
      height: `${LOUPE_SIZE}px`,
      overflow: 'hidden',
      background: '#F5F4F4',
      border: '2px solid #fff',
      outline: '2px solid #171717',
      opacity: '0',
      transition: 'opacity 120ms ease',
    })
    lensImg = makeClone(img, rect)
    lens.appendChild(lensImg)
    layer.appendChild(lens)
    mode = 'loupe'
    updateLoupe(pressX, pressY)
    requestAnimationFrame(() => { if (lens) lens.style.opacity = '1' })
    navigator.vibrate?.(10)
  }

  function endLoupe() {
    cleanup()
  }

  function onTouchStart(e: TouchEvent) {
    lastTouchAt = Date.now()
    if (returning) return
    const touches = e.targetTouches
    if (touches.length >= 2) {
      clearTimeout(longPressTimer)
      if (mode === 'loupe') endLoupe()
      if (mode !== 'pinch' && mode !== 'spent') startPinch(touches[0]!, touches[1]!)
      return
    }
    if (touches.length === 1 && mode === 'idle') {
      const t = touches[0]!
      pressX = t.clientX
      pressY = t.clientY
      mode = 'pending'
      clearTimeout(longPressTimer)
      longPressTimer = setTimeout(startLoupe, LOUPE_DELAY_MS)
    }
  }

  function onTouchMove(e: TouchEvent) {
    const touches = e.targetTouches
    if (mode === 'pinch') {
      if (touches.length >= 2) {
        updatePinch(touches[0]!, touches[1]!)
        if (e.cancelable) e.preventDefault()
      }
      return
    }
    if (mode === 'loupe') {
      const t = touches[0]
      if (e.cancelable) e.preventDefault()
      if (t) updateLoupe(t.clientX, t.clientY)
      return
    }
    if (mode === 'pending') {
      const t = touches[0]
      if (t && Math.hypot(t.clientX - pressX, t.clientY - pressY) > LOUPE_MOVE_CANCEL_PX) {
        // A real drag: the page is scrolling, not a long-press.
        clearTimeout(longPressTimer)
        mode = 'spent'
      }
    }
  }

  function onTouchEnd(e: TouchEvent) {
    clearTimeout(longPressTimer)
    const remaining = e.targetTouches.length
    if (mode === 'pinch' && remaining < 2) {
      endPinch()
      mode = remaining === 0 ? 'idle' : 'spent'
      if (e.cancelable) e.preventDefault()
      return
    }
    if (mode === 'loupe') {
      endLoupe()
      mode = 'idle'
      // The release of a long-press must not also count as a tap/click.
      if (e.cancelable) e.preventDefault()
      return
    }
    if (remaining === 0) mode = 'idle'
  }

  function onTouchCancel() {
    clearTimeout(longPressTimer)
    if (mode === 'pinch') endPinch()
    else if (mode === 'loupe') endLoupe()
    mode = 'idle'
  }

  // Safari's own page-pinch events--preventDefault is what stops the page
  // from zooming underneath the clone.
  function onGesture(e: Event) { e.preventDefault() }
  // Android's long-press image menu (and desktop-touch right-clicks must
  // keep working, hence the recency check).
  function onContextMenu(e: Event) {
    if (Date.now() - lastTouchAt < 1500) e.preventDefault()
  }

  img.addEventListener('touchstart', onTouchStart, { passive: true })
  img.addEventListener('touchmove', onTouchMove, { passive: false })
  img.addEventListener('touchend', onTouchEnd, { passive: false })
  img.addEventListener('touchcancel', onTouchCancel, { passive: true })
  img.addEventListener('gesturestart', onGesture, { passive: false })
  img.addEventListener('gesturechange', onGesture, { passive: false })
  img.addEventListener('contextmenu', onContextMenu)

  return () => {
    clearTimeout(longPressTimer)
    img.removeEventListener('touchstart', onTouchStart)
    img.removeEventListener('touchmove', onTouchMove)
    img.removeEventListener('touchend', onTouchEnd)
    img.removeEventListener('touchcancel', onTouchCancel)
    img.removeEventListener('gesturestart', onGesture)
    img.removeEventListener('gesturechange', onGesture)
    img.removeEventListener('contextmenu', onContextMenu)
    cleanup()
  }
}
