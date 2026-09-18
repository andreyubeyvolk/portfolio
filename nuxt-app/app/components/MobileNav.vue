<script setup lang="ts">
// Overlay + slide-out menu panel + bottom bar for mobile. Toggle/focus-trap
// behavior lives in public/menu.js (ported as-is, see that file's own
// header comment for why it's structured the way it is).
const navLinks = [
  { label: 'Inhouse', to: '/inhouse' },
  { label: 'Brands', to: '/brands' },
  { label: 'Archive', to: '/archive' },
  { label: 'About', to: '/about' },
]
</script>

<template>
  <div class="menu-overlay" id="menu-overlay" aria-hidden="true"></div>

  <div class="mobile-menu" id="mobile-menu" role="dialog" aria-label="Navigation menu" aria-modal="true">
    <nav class="menu-tabs">
      <NuxtLink v-for="link in navLinks" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
    </nav>
  </div>

  <nav class="mobile-bar" aria-label="Mobile navigation">
    <NuxtLink class="mobile-bar__brand" to="/" aria-label="Andrey Ubeyvolk home">
      <span class="brand-mark--text">Andrey Ubeyvolk</span>
      <img class="mobile-brand-lettering" alt="" aria-hidden="true" />
    </NuxtLink>
    <button class="mobile-bar__menu" type="button" aria-expanded="false" aria-controls="mobile-menu">Menu</button>
  </nav>
</template>
