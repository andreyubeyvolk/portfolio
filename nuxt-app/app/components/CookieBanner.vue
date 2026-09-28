<script setup lang="ts">
// Analytics consent banner, bottom-right. Shown only until the visitor
// picks Accept or Decline; Google Analytics isn't loaded at all until
// Accept (see plugins/analytics.client.ts).
const { consent, read, choose } = useCookieConsent()
// Stays hidden until the stored choice has been read on the client, so a
// visitor who already chose never sees it flash in.
const ready = ref(false)

onMounted(() => {
  read()
  ready.value = true
})
</script>

<template>
  <section v-if="ready && consent === null" class="cookie-banner" aria-label="Cookie consent">
    <p class="cookie-banner__text">
      We use cookies for anonymous analytics (Google Analytics) to see how the portfolio is viewed. No ads, no cross-site tracking.
    </p>
    <div class="cookie-banner__actions">
      <button type="button" class="cookie-banner__btn" @click="choose('denied')">Decline</button>
      <button type="button" class="cookie-banner__btn" @click="choose('granted')">Accept</button>
    </div>
  </section>
</template>

<style scoped>
.cookie-banner {
  position: fixed;
  right: var(--page-margin, 16px);
  bottom: var(--page-margin, 16px);
  /* Below the mobile menu veil (.menu-overlay, 99) so an open menu
     covers it like the rest of the page. */
  z-index: 98;
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
  color: #171717;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease;
}

@media (hover: hover) {
  .cookie-banner__btn:hover {
    color: #fff;
    background: #000;
  }
}

/* Phone: full width between the page margins, sitting just above the
   fixed bottom bar (80px from the bottom + 40px tall). */
@media (max-width: 640px) {
  .cookie-banner {
    left: var(--page-margin, 16px);
    bottom: 128px;
    width: auto;
    max-width: none;
  }
}
</style>
