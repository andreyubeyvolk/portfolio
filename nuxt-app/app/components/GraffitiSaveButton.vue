<script setup lang="ts">
// "Save screenshot": a compact black plaque in the bottom-right corner (where
// the cookie banner sits; above it while that is showing) that appears the
// moment there is spray paint on the page and goes away the moment the tag is
// wiped--graffiti.js announces both as the 'graffiti-ink' window event.
//
// A click saves a PNG of the tab exactly as it is on screen, paint included, at
// the display's own pixel density, through the browser's screen-capture API
// (getDisplayMedia asking for this very tab). The browser confirms the capture
// with its own "share this tab" dialog on every save; nothing is recorded, one
// frame is copied and the stream is stopped at once. The button and the
// spray-can cursor are hidden before that frame is taken, so neither is in the
// picture. Chromium only (Chrome, Edge, Opera, Brave): other browsers can only
// capture a whole window or screen, browser UI included, so there the button
// does not show. Desktop with a mouse only, like the graffiti itself.
const { consent } = useCookieConsent()

const supported = ref(false)
const hasInk = ref(false)
const busy = ref(false)
// extra bottom offset while the cookie banner occupies the corner
const lift = ref(0)

function onInk(e: Event) {
  hasInk.value = !!(e as CustomEvent<{ on: boolean }>).detail?.on
}

// The cookie banner (CookieBanner.vue) is the one other thing that lives in
// this corner: while it shows, the button sits one grid gap above it.
function measure() {
  const banner = consent.value === null ? document.querySelector<HTMLElement>('.cookie-banner') : null
  lift.value = banner ? banner.offsetHeight + 16 : 0
}

const style = computed(() => (lift.value ? { bottom: `calc(var(--page-margin, 16px) + ${lift.value}px)` } : undefined))

function isChromium() {
  const uad = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData
  if (uad?.brands) return uad.brands.some(b => /Chromium/i.test(b.brand))
  return /Chrome\//.test(navigator.userAgent)
}

const frame = () => new Promise<void>(r => requestAnimationFrame(() => r()))
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const firstFrame = (video: HTMLVideoElement) => new Promise<void>((r) => {
  if ('requestVideoFrameCallback' in video) (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(() => r())
  else if (video.readyState >= 2) r()
  else video.addEventListener('loadeddata', () => r(), { once: true })
})

function fileName() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `Andrey_Ubeyvolk_Tag_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.png`
}

async function save() {
  if (busy.value) return
  busy.value = true
  document.body.classList.add('graffiti-capturing')
  let stream: MediaStream | undefined
  try {
    // two frames so the button and the cursor are really gone from the screen
    await frame()
    await frame()
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: false,
      // Chromium: offer this tab, preselected, and nothing else
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      monitorTypeSurfaces: 'exclude',
      systemAudio: 'exclude',
    } as DisplayMediaStreamOptions)
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await video.play()
    await firstFrame(video)
    // The browser's own "sharing this tab" bar can take a few lines off the
    // top of the viewport once the stream starts, and the page re-lays out
    // under it: let that settle before copying a frame.
    await wait(300)
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) throw new Error('empty frame')
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h)
    stream.getTracks().forEach(t => t.stop())
    stream = undefined
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'))
    if (!blob) throw new Error('no png')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName()
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  catch {
    // the visitor closed the browser's dialog, or capture is not allowed
    // here: the button simply comes back
  }
  finally {
    stream?.getTracks().forEach(t => t.stop())
    document.body.classList.remove('graffiti-capturing')
    busy.value = false
  }
}

onMounted(() => {
  supported.value = !!navigator.mediaDevices?.getDisplayMedia && isChromium()
  window.addEventListener('graffiti-ink', onInk)
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  window.removeEventListener('graffiti-ink', onInk)
  window.removeEventListener('resize', measure)
})
watch(hasInk, (on) => { if (on) measure() })
// the banner fades out for 300 ms after a choice: drop the lift right away
// rather than measuring the leaving element
watch(consent, (v) => { if (v !== null) lift.value = 0 })
</script>

<template>
  <Transition name="graffiti-save-fade">
    <button
      v-if="supported && hasInk"
      type="button"
      class="graffiti-save"
      :class="{ 'is-capturing': busy }"
      :style="style"
      @click="save"
    >Save screenshot</button>
  </Transition>
</template>

<style scoped>
.graffiti-save-fade-enter-active,
.graffiti-save-fade-leave-active {
  transition: opacity 300ms ease;
}
.graffiti-save-fade-enter-from,
.graffiti-save-fade-leave-to {
  opacity: 0;
}

/* Same plaque as the cookie banner (CookieBanner.vue): 2px padding, #171717,
   white text in the body's own type, inverted on hover--only as wide as its
   text. Sits under the graffiti canvas (z-index 9998, pointer-events none), so
   paint goes over it like over everything else and clicks still reach it. */
.graffiti-save {
  position: fixed;
  right: var(--page-margin, 16px);
  bottom: var(--page-margin, 16px);
  z-index: 100;
  display: none;
  padding: 2px;
  border: 0;
  background: #171717;
  color: #fff;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease;
}
@media (min-width: 981px) and (hover: hover) and (pointer: fine) {
  .graffiti-save {
    display: block;
  }
}
@media (hover: hover) {
  .graffiti-save:hover {
    color: #171717;
    background: #fff;
  }
}
/* Out of the picture while the screenshot is taken--instant, no fade. */
.graffiti-save.is-capturing {
  visibility: hidden;
}
</style>
