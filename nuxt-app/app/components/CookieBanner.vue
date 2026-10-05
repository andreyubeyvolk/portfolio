<script setup lang="ts">
// Analytics consent banner. Desktop/tablet: bottom-right, width matched to
// the home page's own social-links block (see measure() below). Phone:
// full-width, bottom, inverted black/white, with a dim veil behind it
// (same recipe as the mobile menu). Shown only in a region that legally
// requires it (regionRequiresConsent) and only until the visitor picks
// Accept or Decline--Google Analytics isn't loaded at all before Accept
// there (see plugins/analytics.client.ts, which also covers the "no
// prompt needed" case elsewhere).
const { consent, read, choose } = useCookieConsent()
const route = useRoute()
// Stays hidden until mounted (region + stored choice are both client-only
// checks), so a visitor who doesn't need the prompt--or already chose--
// never sees it flash in.
const shouldShow = ref(false)

// Desktop/tablet only: match the banner's left edge + width to the home
// page's own .home-socials block (the two social-link columns) so it
// reads as part of that same layout rhythm instead of a fixed-width box
// dropped on top of it. Measured live via getBoundingClientRect rather
// than replicated in CSS--.home-socials' width comes out of several
// nested grids (site-shell -> content-pane -> home-view), and it already
// renders differently again under the 980px tablet breakpoint, so reading
// the actual box is far more robust than re-deriving that math three ways.
// null on any other page (no .home-socials there) or on phone, where the
// CSS below takes over positioning entirely.
const matchedRect = ref<{ left: number; width: number } | null>(null)

function measure() {
  if (window.innerWidth <= 640) {
    matchedRect.value = null
    return
  }
  const socials = document.querySelector<HTMLElement>('.home-socials')
  if (socials) {
    const r = socials.getBoundingClientRect()
    matchedRect.value = { left: r.left, width: r.width }
    return
  }
  // On non-home pages .home-socials doesn't exist, but .content-pane does and
  // occupies the same column span. .home-socials = right half of .home-view =
  // right half of .content-pane, so mirror that proportion here.
  const pane = document.querySelector<HTMLElement>('.content-pane')
  if (pane) {
    const r = pane.getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap')) || 0
    matchedRect.value = { left: r.left + r.width / 2 + gap / 2, width: r.width / 2 - gap / 2 }
    return
  }
  matchedRect.value = null
}

const bannerStyle = computed(() => {
  if (!matchedRect.value) return undefined
  return { left: `${matchedRect.value.left}px`, width: `${matchedRect.value.width}px`, right: 'auto' }
})

onMounted(() => {
  read()
  // TEMP: shown in every region while the user reviews the banner's
  // design live--restore `shouldShow.value = regionRequiresConsent()`
  // before this ships for real.
  shouldShow.value = true
  measure()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
// .home-socials only exists on "/"--re-measure after any client-side nav
// in or out of the home page (the element itself mounts/unmounts, this
// component doesn't).
watch(() => route.path, () => nextTick(measure))
</script>

<template>
  <Transition name="cookie-fade">
    <div v-if="shouldShow && consent === null" class="cookie-shell">
      <!-- Phone only--same dim-veil recipe as the mobile menu (.menu-overlay
           in mobile.css: neutral gray + faint grain), so the banner reads as
           the same kind of "something needs your attention" overlay instead
           of a stray element floating over full-color content. -->
      <div class="cookie-backdrop" aria-hidden="true" />
      <section class="cookie-banner" :style="bannerStyle" aria-label="Cookie consent">
        <p class="cookie-banner__text">
          We use cookies for anonymous analytics (Google Analytics) to see how the portfolio is viewed. No ads, no cross-site tracking.
        </p>
        <div class="cookie-banner__actions">
          <button type="button" class="cookie-banner__btn" @click="choose('granted')">Accept</button>
          <button type="button" class="cookie-banner__btn" @click="choose('denied')">Decline</button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.cookie-fade-enter-active,
.cookie-fade-leave-active {
  transition: opacity 300ms ease;
}
.cookie-fade-enter-from,
.cookie-fade-leave-to {
  opacity: 0;
}

.cookie-backdrop {
  display: none;
}

.cookie-banner {
  position: fixed;
  right: var(--page-margin, 16px);
  bottom: var(--page-margin, 16px);
  z-index: 100;
  /* 310px = the width that breaks the copy into the mockup's four lines
     (first line fits whole, "portfolio" wraps to line three)--the fallback
     for any page without a .home-socials block to match (see bannerStyle
     in the script, which overrides left/width/right inline on the home
     page instead). */
  width: 310px;
  max-width: calc(100vw - 32px);
  padding: 2px;
  background: #171717;
  color: #fff;
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
    color: #171717;
    background: #fff;
  }
}

/* Phone: the veil dims the whole page (same recipe as the mobile menu)--
   including .mobile-bar, which sits *behind* it here (unlike the mobile
   menu's own veil, where the bar stays on top so its Menu button remains
   usable to close the menu--this veil has no such button to protect, so
   the bar reads as fully dimmed background like everything else). The
   banner itself inverts to black/white, spans the same left/right insets
   as .mobile-bar, and its top edge lines up with .mobile-bar's own top
   edge (bottom:80px + 40px bar height = 120px, same landmark
   .mobile-menu's own bottom already anchors to)--so the popup fills
   exactly the band between the page margin and the bar, growing to that
   fixed height rather than hugging its text. Still below .mobile-menu
   (103) so an explicitly opened menu dialog still takes priority. */
@media (max-width: 640px) {
  .cookie-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 101;
    pointer-events: none;
    background-color: rgba(232, 232, 232, 0.91);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .cookie-banner {
    left: var(--page-margin, 16px);
    width: auto;
    max-width: none;
    /* 120px (mobile-bar's own top edge, see the comment above) minus this
       same page margin--the fixed distance between the two landmarks the
       popup is anchored between. */
    height: 104px;
    z-index: 102;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .cookie-banner__actions {
    margin-top: 0;
  }

  @media (hover: hover) {
    .cookie-banner__btn:hover {
      color: #171717;
      background: #fff;
    }
  }
}
</style>
