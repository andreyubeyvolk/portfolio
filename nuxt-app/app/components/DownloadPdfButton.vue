<script setup lang="ts">
// Ported from main.js's download-flash IIFE—see CopyEmailButton.vue for
// why this is a component instead of the original querySelectorAll pass.
defineProps<{ href: string }>()

const isDownloading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function flash() {
  clearTimeout(timer)
  isDownloading.value = true
  timer = setTimeout(() => { isDownloading.value = false }, 1600)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <a class="download-pdf-btn" :class="{ 'is-downloading': isDownloading }" :href="href" download @click="flash">
    <slot />
  </a>
</template>
