<script setup lang="ts">
// Inhouse projects first, then Brands, each in their own project-order.ts
// sequence—same source of truth the two section listings use, just
// concatenated instead of filtered to one section.
const { data: projects } = await useAsyncData('grid-all', () => {
  return queryCollection('project').all()
})

const orderedProjects = computed(() => {
  const bySlug = new Map((projects.value ?? []).map(p => [`${p.section}/${p.slug}`, p]))
  const order = [
    ...PROJECT_ORDER.inhouse.map(slug => `inhouse/${slug}`),
    ...PROJECT_ORDER.brands.map(slug => `brands/${slug}`),
  ]
  return order.map(key => bySlug.get(key)).filter((p): p is NonNullable<typeof p> => !!p)
})

useSeoMeta({
  title: 'All Projects—Andrey Ubeyvolk',
  description: 'All projects by Andrey Ubeyvolk—in-house brand leadership and independent identity work, together in one place.',
  ogTitle: 'All Projects—Andrey Ubeyvolk',
  ogDescription: 'All projects by Andrey Ubeyvolk—in-house brand leadership and independent identity work, together in one place.',
  twitterTitle: 'All Projects—Andrey Ubeyvolk',
  twitterDescription: 'All projects by Andrey Ubeyvolk—in-house brand leadership and independent identity work, together in one place.',
})

useHead({
  bodyAttrs: { class: 'all-projects-page' },
})

const panelTransitionStyle = usePanelTransitionStyle()
</script>

<template>
  <section class="section-intro home-intro" aria-label="Andrey Ubeyvolk introduction">
    <h1 class="sr-only">All Projects—Andrey Ubeyvolk</h1>
    <p>Conceptual art direction with depth and vision. For startups, AI, crypto, and creative brands.</p>

    <figure class="home-portrait">
      <img width="176" height="176" src="/assets/portrait.webp" alt="Portrait of Andrey Ubeyvolk" />
    </figure>
  </section>

  <section class="content-pane" aria-label="All projects" :style="panelTransitionStyle">
    <ScrollPane>
      <article class="projects-grid">
        <ProjectCard
          v-for="project in orderedProjects"
          :key="`${project.section}-${project.slug}`"
          :section="project.section"
          :slug="project.slug"
          :title="project.title"
          :card-preview="project.cardPreview"
        />
      </article>
    </ScrollPane>
  </section>
</template>
