// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
  ],
  devtools: { enabled: true },
  compatibilityDate: '2024-04-03',
  // /sitemap.xml is a server route (server/routes/sitemap.xml.ts), not a
  // page--`nuxt generate`'s crawler only follows <a>/NuxtLink hrefs it
  // finds in prerendered pages, so a route nothing links to needs listing
  // here explicitly to end up as a static file in the output.
  nitro: {
    prerender: {
      routes: ['/sitemap.xml'],
    },
  },
  // Native (same-document) View Transitions for client-side route
  // changes--see plugins/page-transition.client.ts for how the actual
  // effect (curtain vs. project-cover morph vs. none) is chosen per
  // navigation, and public/page-transitions.css for the CSS driving it.
  // No-op in browsers without API support (Nuxt feature-detects).
  experimental: {
    viewTransition: true,
  },
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
        // Archive page template CSS (the lightbox preview + filmstrip)--
        // ported from that page's own inline <style> block on the static
        // site, same reasoning as project-page.css above.
        { rel: 'stylesheet', href: '/archive-page.css' },
        // Curtain wipe between section pages + the project-cover morph
        // test (see plugins/page-transition.client.ts)--ported from the
        // static site's Cross-Document view-transitions.css prototype,
        // adapted for same-document (client-side route) transitions.
        { rel: 'stylesheet', href: '/page-transitions.css' },
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
        // graffiti.js only DEFINES window.initGraffiti here (see the file's
        // own header)—it doesn't touch the DOM until something calls it, so
        // unlike the nav scripts there's no hydration race loading it as a
        // plain tag. plugins/graffiti.client.ts is what actually calls it,
        // once per navigation.
        { src: '/graffiti.js' },
      ],
    },
  },
})
