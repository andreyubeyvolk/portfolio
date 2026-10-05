<script setup lang="ts">
// Site-wide SEO defaults every page inherits (title/description are set
// per-page via each page's own useSeoMeta, layered on top of these).
const SITE_URL = 'https://andreyubeyvolk.com'
const route = useRoute()
// Every route prerenders to <path>/index.html (Nuxt's default), which
// GitHub Pages serves at the trailing-slash URL--requesting the bare path
// gets a 301 to it. Canonical/og:url pointed at the pre-redirect address;
// this points straight at the address that's actually served, matching
// what a crawler lands on after following that redirect anyway.
const canonicalPath = computed(() => route.path.endsWith('/') ? route.path : `${route.path}/`)
const canonicalUrl = computed(() => `${SITE_URL}${canonicalPath.value}`)

useSeoMeta({
  ogSiteName: 'Andrey Ubeyvolk',
  ogType: 'website',
  ogUrl: canonicalUrl,
  ogImage: `${SITE_URL}/assets/og-cover.jpg?v=2`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterImage: `${SITE_URL}/assets/og-cover.jpg?v=2`,
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
