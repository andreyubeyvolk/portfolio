<script setup lang="ts">
// Site-wide SEO defaults every page inherits (title/description are set
// per-page via each page's own useSeoMeta, layered on top of these).
const SITE_URL = 'https://andreyubeyvolk.com'
const route = useRoute()
const canonicalUrl = computed(() => `${SITE_URL}${route.path}`)

useSeoMeta({
  ogSiteName: 'Andrey Ubeyvolk',
  ogType: 'website',
  ogUrl: canonicalUrl,
  ogImage: `${SITE_URL}/assets/og-cover.webp`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterImage: `${SITE_URL}/assets/og-cover.webp`,
})

useHead({
  htmlAttrs: { lang: 'en' },
  link: [{ rel: 'canonical', href: canonicalUrl }],
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
