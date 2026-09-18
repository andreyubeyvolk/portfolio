// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
  ],
  devtools: { enabled: true },
  compatibilityDate: '2024-04-03',
  app: {
    // NOTE: leave this at '/' for now—the real value (either '/portfolio/'
    // or '/' if a custom domain lands first) is a Stage 7 cutover decision,
    // not something to guess at here.
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=fallback' },
        { rel: 'stylesheet', href: '/styles.css' },
        { rel: 'stylesheet', href: '/mobile.css' },
        { rel: 'stylesheet', href: '/graffiti.css' },
        // Lenis smooth-scroll library (third-party, defines window.Lenis
        // only—doesn't touch the DOM on its own, so unlike the nav scripts
        // there's no hydration race to worry about). See ScrollPane.vue.
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.css' },
        // Project-page template CSS (cover/gallery/video-player/info-note)
        // and the scroll-reveal fade+rise—both used only on project pages,
        // but small enough (and identical across all of them, by design)
        // that a global include is simpler than per-route loading.
        { rel: 'stylesheet', href: '/project-page.css' },
        { rel: 'stylesheet', href: '/scroll-reveal.css' },
        { rel: 'icon', href: '/assets/favicon.svg', type: 'image/svg+xml' },
        { rel: 'icon', href: '/assets/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { rel: 'icon', href: '/assets/favicon-16.png', sizes: '16x16', type: 'image/png' },
        { rel: 'apple-touch-icon', href: '/assets/apple-touch-icon.png' },
      ],
      // Nav behavior scripts (menu.js/logo-scrub.js/mobile-logo-swipe.js)
      // are NOT listed here—loading them as static <script> tags races
      // Vue's hydration (see plugins/legacy-nav-scripts.client.ts for why
      // that matters and where they're actually injected instead).
      script: [
        { src: 'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js' },
      ],
    },
  },
})
