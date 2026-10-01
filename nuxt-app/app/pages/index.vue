<script setup lang="ts">
useSeoMeta({
  title: 'Andrey Ubeyvolk—Conceptual Art Director',
  description: 'Conceptual art director at the intersection of tech and culture—startups, AI, crypto, fashion. Concept-driven brand work by Andrey Ubeyvolk.',
  ogTitle: 'Andrey Ubeyvolk',
  ogDescription: 'Conceptual Art Direction for tech, AI, and creative brands building something new.',
  twitterTitle: 'Andrey Ubeyvolk',
  twitterDescription: 'Conceptual Art Direction for tech, AI, and creative brands building something new.',
})

useHead({
  bodyAttrs: { class: 'home-page' },
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

// Real showreel, one cut per breakpoint--both re-encoded from the
// client's own exports at crf 21 (SSIM >=0.994 against each source).
// Desktop: 1920x1080. Mobile: 1080x1440 (3:4, matching .reel-card's own
// mobile crop), with its own dedicated cover design.
const REEL_SRC = '/assets/home/home-showreel.mp4'
const REEL_SRC_MOBILE = '/assets/home/home-showreel-mobile.mp4'
// The reel's poster is the home page's largest above-the-fold paint, so
// fetch it at high priority instead of waiting on the <video> element--
// one per breakpoint (each gated by the same media the <source>/Vp
// component itself switches on), since the two posters differ.
useHead({
  link: [
    { rel: 'preload', as: 'image', href: videoPoster(REEL_SRC), fetchpriority: 'high', media: '(min-width: 641px)' },
    { rel: 'preload', as: 'image', href: videoPoster(REEL_SRC_MOBILE), fetchpriority: 'high', media: '(max-width: 640px)' },
  ],
})
</script>

<template>
  <section class="section-intro home-intro" aria-label="Andrey Ubeyvolk introduction">
    <h1 class="sr-only">Andrey Ubeyvolk—Conceptual Art Director</h1>
    <div class="intro-text">
      <p>Conceptual Art Director turning ideas into distinctive visual worlds.</p>
      <p>For tech, AI, and creative brands building something new.</p>
    </div>

    <figure class="home-portrait" @click="show">
      <div class="home-portrait__frame">
        <img width="176" height="176" src="/assets/portrait.webp" alt="Andrey Ubeyvolk, conceptual art director" />
      </div>
      <picture v-show="isActive">
        <source media="(min-width: 981px)" srcset="/assets/facepaint.svg" />
        <img ref="paintImg" class="home-portrait__paint" src="/assets/facepaint-mobile.svg" alt="" aria-hidden="true" />
      </picture>
    </figure>
  </section>

  <section class="content-pane home-pane" aria-label="Showreel and contacts">
    <article class="home-view">
      <!-- Autoplays muted on load; volume/timeline controls appear only
           when the video itself is clicked or tapped. -->
      <div class="reel-card">
        <Vp
          :src="REEL_SRC"
          :src-mobile="REEL_SRC_MOBILE"
          :poster-mobile="videoPoster(REEL_SRC_MOBILE)"
          autoplay="immediate"
          reveal-on="click"
          :volume="0.8"
        />
      </div>

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
