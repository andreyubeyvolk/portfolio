<script setup lang="ts">
// Renders project copy with its [label](/path) markers as real internal
// links (crawlable <a> in the prerendered HTML, client-side nav on click).
// Styled via .text-link in styles.css: 1px underline at rest, the site's
// usual black/white inversion on hover/tap.
const props = defineProps<{ text: string }>()
const parts = computed(() => parseInlineLinks(props.text))
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <NuxtLink v-if="part.to" class="text-link" :to="part.to">{{ part.text }}</NuxtLink>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
