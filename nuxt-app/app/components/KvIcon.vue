<script setup lang="ts">
// The Solution block's KV icon: hover-rotate is pure CSS (see .pv-icon:hover
// img in project-page.css); this component owns the cursor-follow "To top"
// tooltip and the actual scroll-to-top behavior. Ported from to-top.js.
//
// `variant` picks which of the two markups to render (desktop button with
// hover tooltip, or the plain mobile tap target)—same split as
// SiteNav/MobileNav in Stage 2: visibility already comes from which parent
// tree (.project-content vs .mobile-project) is showing at a given
// viewport, so this doesn't need its own responsive show/hide logic.
const props = defineProps<{
  src: string
  width: number
  height: number
  variant: 'desktop' | 'mobile'
}>()

const tipRef = useTemplateRef<HTMLElement>('tip')
const tipVisible = ref(false)
const tipStyle = ref({ left: '0px', top: '0px' })
const { scrollTo: scrollPaneTo } = useScrollToPane('.project-scroll')

function scrollToTop() {
  tipVisible.value = false
  scrollPaneTo(0)
}

function onMouseMove(e: MouseEvent) {
  const tip = tipRef.value
  if (!tip) return
  const off = 16
  let left = e.clientX + off
  let top = e.clientY + off
  const tw = tip.offsetWidth
  const th = tip.offsetHeight
  if (left + tw > window.innerWidth - 8) left = e.clientX - off - tw
  if (top + th > window.innerHeight - 8) top = e.clientY - off - th
  if (left < 8) left = 8
  if (top < 8) top = 8
  tipStyle.value = { left: `${left}px`, top: `${top}px` }
  tipVisible.value = true
}

function onMouseLeave() {
  tipVisible.value = false
}

function onMobileKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    scrollToTop()
  }
}
</script>

<template>
  <button
    v-if="variant === 'desktop'"
    class="pv-icon"
    type="button"
    aria-label="Scroll to top"
    @click="scrollToTop"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <img :width="width" :height="height" loading="lazy" :src="src" alt="" aria-hidden="true" />
    <Teleport to="body">
      <div ref="tip" class="pv-icon-tip" :class="{ 'is-visible': tipVisible }" :style="tipStyle">To top ↑</div>
    </Teleport>
  </button>

  <img
    v-else
    :width="width"
    :height="height"
    loading="lazy"
    class="mobile-project__icon"
    :src="src"
    alt="Scroll to top"
    role="button"
    tabindex="0"
    @click="scrollToTop"
    @keydown="onMobileKeydown"
  />
</template>
