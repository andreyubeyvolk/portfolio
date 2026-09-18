<script setup lang="ts">
// Chains to the next REAL project in the same section, per the
// hand-maintained order in utils/projectOrder.ts. Ported from main.js's
// next-project IIFE—computing the target href is now a plain function
// call instead of a data-attribute-driven DOM query, but the fallback
// logic (wrap to the first project; fall back to the section listing if
// there's fewer than 2 real projects) is unchanged.
const props = defineProps<{
  section: 'inhouse' | 'brands'
  slug: string
}>()

const nextHref = computed(() => {
  const order = PROJECT_ORDER[props.section] || []
  const idx = order.indexOf(props.slug)
  const nextSlug = idx === -1 || order.length < 2 ? null : order[(idx + 1) % order.length]
  return nextSlug ? `/${props.section}/${nextSlug}` : `/${props.section}`
})
</script>

<template>
  <NuxtLink class="pv-action__btn next-project-btn" :to="nextHref">
    <slot>Next project</slot>
  </NuxtLink>
</template>
