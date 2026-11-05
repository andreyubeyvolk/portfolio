<script setup lang="ts">
// The switch between the home page and the /mix photo mosaic: a 32x16 outlined
// switch in the bottom-left corner of the page frame, flush with the screen edge
// and as tall as the 16px page margin. Its two halves are 16px wide each, so the
// seam lines up with the left edge of the content. Invisible until hovered, and
// only on a desktop with a mouse (the mosaic page is desktop-only).
//
// A click does not navigate at once: the dark half first slides to the other side
// (a real switch flipping), and only when it has landed does the page curtain start.
const props = defineProps<{
  to: string
  label: string
  // true = the mosaic is showing (dark half on the right)
  on?: boolean
}>()

const FLIP_MS = 300
const moving = ref(false)
// The dark half rests on the right when "on"; while moving it is on the other side.
const atRight = computed(() => !!props.on !== moving.value)

function go() {
  if (moving.value) return
  moving.value = true
  const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : FLIP_MS
  setTimeout(() => navigateTo(props.to), delay)
}

function onClick(e: MouseEvent) {
  // Let the browser handle new-tab / new-window clicks itself.
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  go()
}

defineExpose({ go })
</script>

<template>
  <a
    class="mix-toggle"
    :class="{ 'is-right': atRight, 'is-moving': moving }"
    :href="to"
    :aria-label="label"
    :title="label"
    @click="onClick"
  >
    <svg width="32" height="16" viewBox="0 0 32 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="30" height="14" stroke="#171717" stroke-width="2" />
      <rect x="2" y="2" width="28" height="12" fill="#F5F4F4" />
    </svg>
    <span class="mix-toggle__knob" aria-hidden="true"></span>
  </a>
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
/* Shown while flipping even if the pointer is not on it (Esc on the mosaic). */
.mix-toggle:hover,
.mix-toggle:focus-visible,
.mix-toggle.is-moving {
  opacity: 1;
}

/* The dark half: 14x12 inside the outline, resting on the left (off) or the right (on). */
.mix-toggle__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 12px;
  overflow: hidden;
  background: #171717;
  pointer-events: none;
  transition: transform 260ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mix-toggle.is-right .mix-toggle__knob {
  transform: translateX(14px);
}

/* Same sheen as the info-note buttons on the project photos (.info-note__toggle
   in project-page.css), on the dark half of the switch. */
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

@media (prefers-reduced-motion: reduce) {
  .mix-toggle__knob {
    transition: none;
  }
}
</style>
