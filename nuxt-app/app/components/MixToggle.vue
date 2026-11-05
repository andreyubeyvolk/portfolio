<script setup lang="ts">
// The switch between the home page and the /mix photo mosaic: a 32x16 outlined
// switch in the bottom-left corner of the page frame, flush with the screen edge
// and as tall as the 16px page margin. Its two halves are 16px wide each, so the
// seam lines up with the left edge of the content. Invisible until hovered, and
// only on a desktop with a mouse (the mosaic page is desktop-only).
defineProps<{
  to: string
  label: string
  // true = the mosaic is showing (dark half on the right)
  on?: boolean
}>()
</script>

<template>
  <NuxtLink class="mix-toggle" :class="{ 'is-on': on }" :to="to" :aria-label="label" :title="label">
    <svg width="32" height="16" viewBox="0 0 32 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="30" height="14" stroke="#171717" stroke-width="2" />
      <rect x="2" y="2" width="14" height="12" :fill="on ? '#F5F4F4' : '#171717'" />
      <rect x="16" y="2" width="14" height="12" :fill="on ? '#171717' : '#F5F4F4'" />
    </svg>
    <span class="mix-toggle__knob" aria-hidden="true"></span>
  </NuxtLink>
</template>

<style scoped>
.mix-toggle {
  position: fixed;
  left: 0;
  bottom: 0;
  z-index: 51;
  display: none;
  width: 32px;
  height: 16px;
  line-height: 0;
  opacity: 0;
  transition: opacity 200ms ease;
}
@media (min-width: 981px) and (hover: hover) and (pointer: fine) {
  .mix-toggle {
    display: block;
  }
}
.mix-toggle svg {
  display: block;
}
.mix-toggle:hover,
.mix-toggle:focus-visible {
  opacity: 1;
}

/* Same sheen as the info-note buttons on the project photos (.info-note__toggle
   in project-page.css), on the dark half of the switch. */
.mix-toggle__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 12px;
  overflow: hidden;
  pointer-events: none;
}
.mix-toggle.is-on .mix-toggle__knob {
  left: 16px;
}
.mix-toggle__knob::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 47%, rgba(255, 255, 255, 0.9) 50%, transparent 53%);
  transform: translateX(-120%);
}
@media (hover: hover) {
  .mix-toggle:hover .mix-toggle__knob::after {
    animation: mix-sheen 0.45s ease-in;
  }
}
@keyframes mix-sheen {
  from { transform: translateX(-120%); }
  to { transform: translateX(120%); }
}
</style>
