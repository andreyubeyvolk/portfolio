<script setup lang="ts">
// Shared grid template for Inhouse and Brands (CLAUDE.md: "same page
// template, same component system, just a different active nav item and
// a different section-intro paragraph"). Card order comes from
// utils/projectOrder.ts, not content/query order--that file is the
// hand-maintained click-through sequence (also used by NextProjectButton),
// so it doubles as the listing order and stays the single source of truth
// as new projects are added.
const props = defineProps<{
  section: 'inhouse' | 'brands'
  title: string
}>()

const { data: projects } = await useAsyncData(`grid-${props.section}`, () => {
  return queryCollection('project').where('section', '=', props.section).all()
})

const orderedProjects = computed(() => {
  const order = PROJECT_ORDER[props.section]
  const bySlug = new Map((projects.value ?? []).map(p => [p.slug, p]))
  return order.map(slug => bySlug.get(slug)).filter((p): p is NonNullable<typeof p> => !!p)
})
</script>

<template>
  <section class="section-intro intro" :aria-label="`${title} section introduction`">
    <h1 class="section-page-title">{{ title }}</h1>
    <p>{{ sectionIntroText(section) }}</p>
  </section>

  <section class="content-pane" :aria-label="`${title} projects`">
    <ScrollPane>
      <article class="inhouse-grid">
        <NuxtLink
          v-for="project in orderedProjects"
          :key="project.slug"
          class="inhouse-card"
          :to="`/${section}/${project.slug}`"
        >
          <div class="inhouse-card__cover">
            <img width="1080" height="1440" :src="`/assets/${section}/${project.slug}/${project.slug}-card.webp`" :alt="project.title" />
          </div>
          <span class="inhouse-title">{{ project.title }}</span>
        </NuxtLink>
      </article>
    </ScrollPane>
  </section>
</template>
