<script setup lang="ts">
// Project copy: a blank line in the content text starts a new paragraph (the
// site-wide 8px gap, see .text-block in styles.css); [label](/path) markers
// inside a paragraph become internal links (LinkedText.vue).
const props = defineProps<{ text: string }>()
const paragraphs = computed(() => props.text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean))
</script>

<template>
  <div class="text-block">
    <p v-for="(para, i) in paragraphs" :key="i"><LinkedText :text="para" /></p>
  </div>
</template>
