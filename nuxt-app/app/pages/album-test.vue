<script setup lang="ts">
// HIDDEN TEST PAGE (not linked anywhere, noindex, not in the sitemap): the real
// Sumsub project page with the interactive photo album slotted in before the
// Team block, so the embed can be checked on every device exactly as it will
// ship. The album picks its own version (3D on desktop, flat pre-rendered pictures on phones / weak devices);
// add ?mode=flat or ?mode=3d to this page's URL to force one.
// Once approved the same gallery row goes into content/projects/sumsub.md and
// this page + its prerender entry in nuxt.config.ts are deleted.
const { data: project } = await useAsyncData('album-test', () => {
  return queryCollection('project').where('section', '=', 'inhouse').where('slug', '=', 'sumsub').first()
})

if (!project.value) {
  throw createError({ statusCode: 404, statusMessage: 'Project not found', fatal: true })
}

useSeoMeta({
  title: 'Album test—Andrey Ubeyvolk',
  robots: 'noindex, nofollow',
})
useHead({ bodyAttrs: { class: 'project-page' } })

const albumSrc = '/albums/sumsub/index.html?embed=1&v=9'
const flatSrc = '/albums/sumsub/flat/index.html?v=9'

const gallery = computed(() => {
  const rows = [...project.value!.gallery] as any[]
  const albumRow = {
    type: 'wide',
    item: {
      type: 'embed',
      src: albumSrc,
      flatSrc,
      width: 2160,
      height: 1440,
      poster: '/assets/inhouse/sumsub/sumsub-album-poster.webp',
      title: 'Interactive photo album: the design and brand team',
      note: 'Design and brand team 2021–2025',
    },
  }
  const at = rows.findIndex(r => r.type === 'text' && r.label === 'Team')
  rows.splice(at < 0 ? rows.length : at, 0, albumRow)
  return rows
})
</script>

<template>
  <ProjectPage
    v-if="project"
    section="inhouse"
    :slug="project.slug"
    :title="project.title"
    :cover="project.cover"
    :about="project.about"
    :gallery="gallery"
    :challenge="project.challenge"
    :solution="project.solution"
    :kv="project.kv"
    :zip-url="project.zipUrl"
  />
</template>
