<script setup lang="ts">
// Analytics consent banner, bottom-right (bottom, full-width and inverted
// to black on phones). Shown only in a region that legally requires it
// (regionRequiresConsent) and only until the visitor picks Accept or
// Decline--Google Analytics isn't loaded at all before Accept there (see
// plugins/analytics.client.ts, which also covers the "no prompt needed"
// case elsewhere).
const { consent, read, choose } = useCookieConsent()
// Stays hidden until mounted (region + stored choice are both client-only
// checks), so a visitor who doesn't need the prompt--or already chose--
// never sees it flash in.
const shouldShow = ref(false)

onMounted(() => {
  read()
  shouldShow.value = regionRequiresConsent()
})
</script>

<template>
  <template v-if="shouldShow && consent === null">
    <!-- Phone only--same dim-veil recipe as the mobile menu (.menu-overlay
         in mobile.css: neutral gray + faint grain), so the banner reads as
         the same kind of "something needs your attention" overlay instead
         of a stray element floating over full-color content. -->
    <div class="cookie-backdrop" aria-hidden="true" />
    <section class="cookie-banner" aria-label="Cookie consent">
      <p class="cookie-banner__text">
        We use cookies for anonymous analytics (Google Analytics) to see how the portfolio is viewed. No ads, no cross-site tracking.
      </p>
      <div class="cookie-banner__actions">
        <button type="button" class="cookie-banner__btn" @click="choose('denied')">Decline</button>
        <button type="button" class="cookie-banner__btn" @click="choose('granted')">Accept</button>
      </div>
    </section>
  </template>
</template>

<style scoped>
.cookie-backdrop {
  display: none;
}

.cookie-banner {
  position: fixed;
  right: var(--page-margin, 16px);
  bottom: var(--page-margin, 16px);
  z-index: 100;
  /* 310px = the width that breaks the copy into the mockup's four lines
     (first line fits whole, "portfolio" wraps to line three). */
  width: 310px;
  max-width: calc(100vw - 32px);
  padding: 2px;
  background: #fff;
  color: #171717;
}

.cookie-banner__text {
  margin: 0;
}

.cookie-banner__actions {
  display: flex;
  gap: 14px;
  margin-top: 16px;
}

.cookie-banner__btn {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  color: inherit;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease;
}

@media (hover: hover) {
  .cookie-banner__btn:hover {
    color: #fff;
    background: #000;
  }
}

/* Phone: the veil dims the whole page (same recipe as the mobile menu),
   and the banner itself inverts to black/white and sits flush at the
   bottom after the page margin--on top of everything, including the fixed
   mobile bar underneath it (same z-index tier; CookieBanner is mounted
   after MobileNav in the layout, so it paints on top at a tie), but still
   below the mobile-menu dialog itself (101) so an explicitly opened menu
   still takes priority. */
@media (max-width: 640px) {
  .cookie-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 99;
    pointer-events: none;
    background-color: rgba(232, 232, 232, 0.91);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .cookie-banner {
    left: var(--page-margin, 16px);
    width: auto;
    max-width: none;
    background: #171717;
    color: #fff;
  }

  @media (hover: hover) {
    .cookie-banner__btn:hover {
      color: #171717;
      background: #fff;
    }
  }
}
</style>
