<script setup lang="ts">
useSeoMeta({
  title: 'Andrey Ubeyvolk—Conceptual Art Director',
  description: 'Conceptual art director at the intersection of tech and culture—startups, AI, crypto, fashion. Concept-driven brand work by Andrey Ubeyvolk.',
  ogTitle: 'Andrey Ubeyvolk',
  ogDescription: 'Conceptual art direction with depth and vision. For startups, AI, crypto, and creative brands.',
  twitterTitle: 'Andrey Ubeyvolk',
  twitterDescription: 'Conceptual art direction with depth and vision. For startups, AI, crypto, and creative brands.',
})

useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Andrey Ubeyvolk',
      jobTitle: 'Conceptual Art Director',
      url: 'https://andreyubeyvolk.com/',
      image: 'https://andreyubeyvolk.com/assets/portrait.webp',
      sameAs: [
        'https://t.me/andreyubeyvolk',
        'https://www.linkedin.com/in/andrei-ubeyvolk-b318a817b',
        'https://www.youtube.com/@visual_athleticism',
        'https://t.me/visual_athleticism',
        'https://instagram.com/andreyubeyvolk/',
      ],
    }),
  }],
})

// Portrait click demo: a paint-splash mark (facepaint.svg desktop /
// facepaint-mobile.svg mobile--real design assets, splash art WITH its
// instructional text baked in as vector shapes--"Ctrl" on desktop,
// "Psh" on mobile/touch, since there's no keyboard modifier to name
// there) appears over the portrait for 3s, nudging toward the hidden
// Ctrl+drag graffiti feature, then clears. Both appear AND disappear
// via the same sponge/board-eraser sweep graffiti.js's own tag clear
// uses--one animation, two directions/orderings, not a different
// mechanic for each end.
const SHOW_MS = 3000
const paintImg = useTemplateRef<HTMLImageElement>('paintImg')
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
  dismissTimer = setTimeout(dismiss, SHOW_MS)
}

onBeforeUnmount(() => clearTimeout(dismissTimer))
</script>

<template>
  <section class="section-intro home-intro" aria-label="Andrey Ubeyvolk introduction">
    <h1 class="sr-only">Andrey Ubeyvolk—Conceptual Art Director</h1>
    <p>Conceptual art direction with depth and vision. For startups, AI, crypto, and creative brands.</p>

    <figure class="home-portrait" @click="show">
      <div class="home-portrait__frame">
        <img width="176" height="176" src="/assets/portrait.webp" alt="Portrait of Andrey Ubeyvolk" />
      </div>
      <picture v-show="isActive">
        <source media="(min-width: 981px)" srcset="/assets/facepaint.svg" />
        <img ref="paintImg" class="home-portrait__paint" src="/assets/facepaint-mobile.svg" alt="" aria-hidden="true" />
      </picture>
    </figure>
  </section>

  <section class="content-pane home-pane" aria-label="Showreel and contacts">
    <article class="home-view">
      <!-- Not yet wired to actual playback on the static site either (no
           click handler exists there)--porting the same inert visual, not
           a regression. -->
      <button class="reel-card" type="button" aria-label="Play reel">
        <img width="1920" height="1080" loading="lazy" class="reel-card__poster" src="/assets/reel.webp" alt="" />
        <span class="reel-card__cta" aria-hidden="true">
          <img width="24" height="24" loading="lazy" class="reel-card__icon" src="/assets/reel-icon.svg" alt="" />
          <img width="36" height="24" loading="lazy" class="reel-card__text" src="/assets/reel-text.svg" alt="" />
        </span>
        <span class="reel-card__overlay-left" aria-hidden="true">Art direction for startups</span>
        <span class="reel-card__overlay-right" aria-hidden="true">and digital companies</span>
      </button>

      <NuxtLink class="home-projects-link" to="/all-projects">All projects</NuxtLink>

      <address class="home-socials">
        <CopyEmailButton class="copy-mail-link" email="6169393@gmail.com">Mail</CopyEmailButton>
        <a href="https://t.me/andreyubeyvolk" target="_blank" rel="noreferrer">Telegram</a>
        <a href="https://www.linkedin.com/in/andrei-ubeyvolk-b318a817b" target="_blank" rel="noreferrer">LinkedIn</a>
        <a href="https://www.youtube.com/@visual_athleticism" target="_blank" rel="noreferrer">YouTube</a>
        <a href="https://t.me/visual_athleticism" target="_blank" rel="noreferrer">Telegram Channel</a>
        <a href="https://instagram.com/andreyubeyvolk/" target="_blank" rel="noreferrer">Instagram</a>
      </address>
    </article>
  </section>
</template>
