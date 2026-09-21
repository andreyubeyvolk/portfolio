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

// Portrait click demo: a spray-can mark (portrait-spray.svg--a real design
// asset, not procedurally drawn) reveals left-to-right across the eyes,
// nudging toward the hidden Ctrl+drag graffiti feature. Desktop also gets
// an instructional plaque; mobile (no Ctrl key to speak of) just gets the
// mark itself.
const HINT_MS = 5000
const sprayImg = useTemplateRef<HTMLImageElement>('sprayImg')
const isActive = ref(false)
const isRevealed = ref(false)
const isHintOpen = ref(false)
let dismissTimer: ReturnType<typeof setTimeout> | undefined

function isDesktop() {
  return window.matchMedia('(min-width: 981px) and (pointer: fine)').matches
}

// Same "board eraser" diagonal sweep as the Archive lightbox's graffiti
// tag clear (graffiti.js's own wipeAway)--duplicated here rather than
// reached into from that vanilla script, since this <img> is a completely
// separate, Vue-owned surface with its own lifecycle.
function wipeAway(el: HTMLElement, onDone: () => void) {
  const DURATION = 850
  const BAND = 4
  let start: number | null = null
  function frame(now: number) {
    if (start === null) start = now
    const t = Math.min(1, (now - start) / DURATION)
    const eased = 1 - (1 - t) ** 2
    const pos = eased * (100 + BAND) - BAND
    const mask = `linear-gradient(to bottom right, transparent ${pos}%, #000 ${pos + BAND}%)`
    el.style.webkitMaskImage = mask
    el.style.maskImage = mask
    if (t < 1) {
      requestAnimationFrame(frame)
    } else {
      onDone()
      el.style.webkitMaskImage = ''
      el.style.maskImage = ''
    }
  }
  requestAnimationFrame(frame)
}

function dismiss() {
  clearTimeout(dismissTimer)
  isHintOpen.value = false
  const img = sprayImg.value
  if (img) wipeAway(img, () => { isRevealed.value = false })
  else isRevealed.value = false
  isActive.value = false
}

function show() {
  isActive.value = true
  isRevealed.value = true
  if (isDesktop()) isHintOpen.value = true
  dismissTimer = setTimeout(dismiss, HINT_MS)
}

function onPortraitClick() {
  if (isActive.value) {
    if (isDesktop()) dismiss() // early dismiss on a second click--desktop only, per spec
    return
  }
  show()
}

onBeforeUnmount(() => clearTimeout(dismissTimer))
</script>

<template>
  <section class="section-intro home-intro" aria-label="Andrey Ubeyvolk introduction">
    <h1 class="sr-only">Andrey Ubeyvolk—Conceptual Art Director</h1>
    <p>Conceptual art direction with depth and vision. For startups, AI, crypto, and creative brands.</p>

    <figure class="home-portrait" @click="onPortraitClick">
      <div class="home-portrait__frame">
        <img width="176" height="176" src="/assets/portrait.webp" alt="Portrait of Andrey Ubeyvolk" />
        <img
          ref="sprayImg"
          class="home-portrait__spray"
          :class="{ 'is-revealed': isRevealed }"
          src="/assets/portrait-spray.svg"
          alt=""
          aria-hidden="true"
        />
      </div>
      <div class="home-portrait__hint" :class="{ 'is-open': isHintOpen }" aria-hidden="true">
        Press CTRL + Click<br />to spray paint! Pshh Pshh…
      </div>
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
