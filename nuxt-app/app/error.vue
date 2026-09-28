<script setup lang="ts">
import type { NuxtError } from '#app'

// Ported from the static site's own 404.html design: an empty crossed-out
// frame with a small label in the middle. Rendered inside the default
// layout so the sidebar nav (desktop) and the Menu bar (mobile) still work
// from a dead link. Non-404 errors reuse the same frame with a generic line.
const props = defineProps<{ error: NuxtError }>()
const isNotFound = computed(() => props.error.statusCode === 404)

useSeoMeta({
  title: () => `${isNotFound.value ? '404' : 'Error'}—Andrey Ubeyvolk`,
  description: 'Page not found—Andrey Ubeyvolk',
  robots: 'noindex',
})

useHead({
  bodyAttrs: { class: 'not-found-page' },
})
</script>

<template>
  <NuxtLayout>
    <h1 class="sr-only">Page Not Found—Andrey Ubeyvolk</h1>
    <div class="not-found-pane">
      <div class="not-found-box">
        <svg class="not-found-box__x" preserveAspectRatio="none" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <line x1="0" y1="0" x2="1" y2="1" vector-effect="non-scaling-stroke" stroke="#D3D3D3" stroke-width="2" />
          <line x1="1" y1="0" x2="0" y2="1" vector-effect="non-scaling-stroke" stroke="#D3D3D3" stroke-width="2" />
        </svg>
        <div class="not-found-label">
          <p>{{ isNotFound ? 404 : error.statusCode }}</p>
          <template v-if="isNotFound">
            <p>Wrong address.</p>
            <p>The work is elsewhere.</p>
          </template>
          <p v-else>Something went wrong.</p>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<!-- Not scoped: the mobile rule has to reach .site-nav, which lives in
     SiteNav.vue, not this component. -->
<style>
.not-found-pane {
  grid-column: 5 / 25;
  display: flex;
  padding: 0;
}

.not-found-box {
  flex: 1;
  position: relative;
  border: 2px solid #D3D3D3;
  overflow: hidden;
  background: #F5F4F4;
}

.not-found-box__x {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.not-found-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #F5F4F4;
  border: 2px solid #D3D3D3;
  padding: 4px 6px;
  text-align: center;
  white-space: nowrap;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.4px;
}

.not-found-label p {
  margin: 0;
}

.not-found-label p:first-child {
  font-family: 'Impact', 'Arial Narrow', sans-serif;
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0;
}

@media (max-width: 640px) {
  .not-found-page .site-nav {
    display: none;
  }

  .not-found-pane {
    position: fixed;
    inset: 16px;
    display: flex;
    grid-column: unset;
  }
}
</style>
