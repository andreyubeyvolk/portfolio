<script setup lang="ts">
useSeoMeta({
  title: 'Inhouse—Andrey Ubeyvolk',
  description: 'In-house art direction by Andrey Ubeyvolk—brand communications, design systems and campaigns built from the inside.',
  ogTitle: 'Inhouse—Andrey Ubeyvolk',
  ogDescription: 'In-house art direction by Andrey Ubeyvolk—brand communications, design systems and campaigns built from the inside.',
  twitterTitle: 'Inhouse—Andrey Ubeyvolk',
  twitterDescription: 'In-house art direction by Andrey Ubeyvolk—brand communications, design systems and campaigns built from the inside.',
})

useHead({
  bodyAttrs: { class: 'inhouse-page' },
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify(breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Inhouse', path: '/inhouse' },
    ])),
  }],
})
</script>

<template>
  <ProjectGrid section="inhouse" title="Inhouse" />
</template>
