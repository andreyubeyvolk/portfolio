<script setup lang="ts">
// Single source of truth for the sidebar: logo + main nav, identical on
// every page. Ported from the static site's <aside class="site-nav"> —
// change it once here, it changes everywhere (this is the whole point of
// the Nuxt migration: no more hand-copied nav markup per page).
const route = useRoute()

const navLinks = [
  { label: 'Inhouse', to: '/inhouse' },
  { label: 'Brands', to: '/brands' },
  { label: 'Archive', to: '/archive' },
  { label: 'About', to: '/about' },
]

function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <aside class="site-nav" aria-label="Main navigation">
    <!-- Logo hover-scrub (shared site-wide): hover scrubs through 7
         brush-stroke logo variants, one per hover-enter. Click still goes
         home. Behavior lives in public/logo-scrub.js (ported as-is from
         the static site, see that file's own header comment).

         #brand-scrub/.brand live on this wrapper <div>, not on the
         NuxtLink itself: NuxtLink is a RouterLink under the hood, and Vue
         recomputes its element's full class string on every client-side
         navigation (active/exact-active tracking)—which would silently
         wipe the is-transitioning/is-scrubbing classes logo-scrub.js adds
         imperatively, the moment you first navigate anywhere. The link's
         own box disappears via display:contents (see <style> below) so
         .brand's sizing/layout applies to its children exactly as before. -->
    <div id="brand-scrub" class="brand">
      <NuxtLink class="brand-link" to="/" aria-label="Andrey Ubeyvolk home">
        <span class="brand-mark brand-mark--text">Andrey Ubeyvolk</span>
        <img class="brand-mark brand-mark--brush" src="/assets/logo/logo-01.svg" alt="" aria-hidden="true" />
        <img class="brand-mark brand-mark--brush" src="/assets/logo/logo-02.svg" alt="" aria-hidden="true" />
        <img class="brand-mark brand-mark--brush" src="/assets/logo/logo-03.svg" alt="" aria-hidden="true" />
        <img class="brand-mark brand-mark--brush" src="/assets/logo/logo-04.svg" alt="" aria-hidden="true" />
        <img class="brand-mark brand-mark--brush" src="/assets/logo/logo-05.svg" alt="" aria-hidden="true" />
        <img class="brand-mark brand-mark--brush" src="/assets/logo/logo-06.svg" alt="" aria-hidden="true" />
        <img class="brand-mark brand-mark--brush" src="/assets/logo/logo-07.svg" alt="" aria-hidden="true" />
      </NuxtLink>
    </div>

    <nav class="nav-list">
      <NuxtLink
        v-for="link in navLinks"
        :key="link.to"
        :class="{ 'is-active': isActive(link.to) }"
        :to="link.to"
      >{{ link.label }}</NuxtLink>
    </nav>
  </aside>
</template>

<style scoped>
.brand-link {
  display: contents;
}
</style>
