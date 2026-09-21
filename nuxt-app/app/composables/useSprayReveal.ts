import type { Ref } from 'vue'

// Shared click-to-reveal mechanic for the paint-splash demo marks (home
// portrait's Ctrl+Click nudge, About's "Open to" portrait)--appears over
// its target image for `showMs`, then clears, both via the same
// sponge/board-eraser sweep graffiti.js's own tag clear uses.
export function useSprayReveal(paintImg: Ref<HTMLImageElement | null>, showMs = 3000) {
  const isActive = ref(false)
  let dismissTimer: ReturnType<typeof setTimeout> | undefined

  // Board-eraser diagonal sweep, same technique as the Archive lightbox's
  // graffiti tag clear (graffiti.js's own wipeAway). `mode: 'hide'` erases
  // top-left-to-bottom-right, matching that existing clear. `mode:
  // 'reveal'` sweeps the same direction but grows the VISIBLE region from
  // top-left instead of the hidden one--spraying on left-to-right, the way
  // the mark would actually get drawn, rather than assembling backwards
  // from the opposite corner (which is what running the same gradient
  // stops in reverse-time would do).
  function sponge(el: HTMLElement, mode: 'reveal' | 'hide', onDone: () => void) {
    const DURATION = 700
    const BAND = 4
    let start: number | null = null
    function frame(now: number) {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / DURATION)
      const eased = 1 - (1 - t) ** 2
      const pos = eased * (100 + BAND) - BAND
      const mask = mode === 'hide'
        ? `linear-gradient(to bottom right, transparent ${pos}%, #000 ${pos + BAND}%)`
        : `linear-gradient(to bottom right, #000 ${pos}%, transparent ${pos + BAND}%)`
      el.style.webkitMaskImage = mask
      el.style.maskImage = mask
      if (t < 1) {
        requestAnimationFrame(frame)
      } else {
        onDone()
      }
    }
    requestAnimationFrame(frame)
  }

  function dismiss() {
    clearTimeout(dismissTimer)
    const el = paintImg.value
    if (el) {
      sponge(el, 'hide', () => {
        el.style.webkitMaskImage = ''
        el.style.maskImage = ''
        isActive.value = false
      })
    } else {
      isActive.value = false
    }
  }

  function show() {
    if (isActive.value) return
    isActive.value = true
    const el = paintImg.value
    if (el) {
      // Starts fully masked (nothing shown) so the very first frame of the
      // reveal sweep is the actual start state, not a flash of the whole
      // mark before the mask engages--matches sponge()'s own t=0 output
      // for mode:'reveal' (pos=-4, everything past it extends transparent).
      el.style.webkitMaskImage = 'linear-gradient(to bottom right, #000 -4%, transparent 0%)'
      el.style.maskImage = el.style.webkitMaskImage
      requestAnimationFrame(() => {
        sponge(el, 'reveal', () => {
          el.style.webkitMaskImage = ''
          el.style.maskImage = ''
        })
      })
    }
    dismissTimer = setTimeout(dismiss, showMs)
  }

  onBeforeUnmount(() => clearTimeout(dismissTimer))

  return { isActive, show }
}
