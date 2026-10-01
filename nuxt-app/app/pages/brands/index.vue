<script setup lang="ts">
useSeoMeta({
  title: 'Brands—Andrey Ubeyvolk',
  description: 'Brand projects by Andrey Ubeyvolk—visual identity and communications for startups, tech and culture companies.',
  ogTitle: 'Brands—Andrey Ubeyvolk',
  ogDescription: 'Brand projects by Andrey Ubeyvolk—visual identity and communications for startups, tech and culture companies.',
  twitterTitle: 'Brands—Andrey Ubeyvolk',
  twitterDescription: 'Brand projects by Andrey Ubeyvolk—visual identity and communications for startups, tech and culture companies.',
})

useHead({
  bodyAttrs: { class: 'brands-page' },
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify(breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Brands', path: '/brands' },
    ])),
  }],
})
</script>

<template>
  <ProjectGrid section="brands" title="Brands" />
</template>
