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
// instructional text baked in as vector shapes--"Ctrl" on desktop, no
// text on mobile/touch since there's no keyboard modifier to name
// there) appears over the portrait for 3s, then clears--see
// useSprayReveal for the shared reveal/hide mechanic (also used by
// About's "Open to" portrait).
const paintImg = useTemplateRef<HTMLImageElement>('paintImg')
const { isActive, show } = useSprayReveal(paintImg)
</script>

<template>
  <section class="section-intro home-intro" aria-label="Andrey Ubeyvolk introduction">
    <h1 class="sr-only">Andrey Ubeyvolk—Conceptual Art Director</h1>
    <div class="intro-paragraph"><p>Conceptual Art Director turning ideas into distinctive visual worlds.</p></div>
    <div class="intro-paragraph"><p>For tech, AI, and creative brands building something new.</p></div>

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
