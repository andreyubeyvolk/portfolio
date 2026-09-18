<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string

const { data: project } = await useAsyncData(`brands-${slug}`, () => {
  return queryCollection('project').where('section', '=', 'brands').where('slug', '=', slug).first()
})

if (!project.value) {
  throw createError({ statusCode: 404, statusMessage: 'Project not found', fatal: true })
}

useSeoMeta({
  title: () => `${project.value!.title}—Andrey Ubeyvolk`,
  description: () => project.value!.description,
  ogTitle: () => `${project.value!.title}—Andrey Ubeyvolk`,
  ogDescription: () => project.value!.description,
  twitterTitle: () => `${project.value!.title}—Andrey Ubeyvolk`,
  twitterDescription: () => project.value!.description,
})

useHead({
  bodyAttrs: { class: 'project-page' },
})
</script>

<template>
  <ProjectPage
    v-if="project"
    section="brands"
    :slug="project.slug"
    :title="project.title"
    :cover="project.cover"
    :about="project.about"
    :gallery="project.gallery"
    :challenge="project.challenge"
    :solution="project.solution"
    :kv="project.kv"
    :zip-url="project.zipUrl"
  />
</template>
