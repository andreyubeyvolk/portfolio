<script setup lang="ts">
const { data: page } = await useAsyncData('about', () => {
  return queryCollection('about').first()
})

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

useSeoMeta({
  title: page.value.title,
  description: page.value.description,
  ogTitle: page.value.title,
  ogDescription: page.value.description,
  twitterTitle: page.value.title,
  twitterDescription: page.value.description,
})

// Several mobile.css rules (.about-page .about-download-mobile, .about-page
// .open-to-portrait, etc.) are scoped to this per-page body class, same
// convention as inhouse-page/brands-page/archive-page/project-page on the
// static site. There's one shared <body> across the whole SPA now instead
// of a fresh one per page load, so it has to be set reactively per page
// rather than baked into static HTML—useHead handles swapping it cleanly
// on every navigation.
useHead({
  bodyAttrs: { class: 'about-page' },
})
</script>

<template>
  <section class="section-intro home-intro" aria-label="About Andrey Ubeyvolk">
    <h1 class="section-page-title">{{ page.intro.heading }}</h1>
    <p>{{ page.intro.text }}</p>
  </section>

  <section class="content-pane about-pane" aria-label="About content">
    <ScrollPane>
      <article class="about-view">
        <figure class="about-photo">
          <img width="1400" height="716" :src="page.photo" alt="Andrey Ubeyvolk" />
        </figure>

        <!-- Approach—no top line (first section) -->
        <section class="about-section">
          <h2 class="about-section__label">Approach</h2>
          <div class="about-section__content">
            <div v-for="item in page.approach" :key="item.title" class="service-row">
              <span class="service-row__title">{{ item.title }}</span>
              <p class="service-row__desc">{{ item.desc }}</p>
            </div>
          </div>
        </section>

        <!-- Focus—4px top line -->
        <section class="about-section">
          <h2 class="about-section__label">Focus</h2>
          <div class="about-section__content">
            <div v-for="item in page.focus" :key="item.title" class="service-row">
              <span class="service-row__title">{{ item.title }}</span>
              <p class="service-row__desc">{{ item.desc }}</p>
            </div>
          </div>
        </section>

        <!-- Leading Teams—4px top line -->
        <section class="about-section">
          <h2 class="about-section__label">Leading<br />Teams</h2>
          <div class="about-section__content">
            <p>{{ page.leadingTeams }}</p>
          </div>
        </section>

        <!-- Experience—4px top line -->
        <section class="about-section">
          <h2 class="about-section__label">Experience</h2>
          <div class="about-section__content">
            <div v-for="row in page.experience" :key="row.company" class="exp-row">
              <span class="exp-row__company">{{ row.company }}</span>
              <span class="exp-row__role">{{ row.role }}</span>
              <span class="exp-row__years">{{ row.years }}</span>
            </div>
          </div>
        </section>

        <!-- Open to—4px top line -->
        <section class="about-section about-section--open-to">
          <h2 class="about-section__label">Open to</h2>
          <div class="about-section__content">
            <p>{{ page.openTo }}</p>
            <img width="176" height="176" loading="lazy" class="open-to-portrait" :src="page.portrait" alt="" aria-hidden="true" />
          </div>
        </section>

        <!-- Contact—4px top line -->
        <section class="about-section about-section--contact">
          <h2 class="about-section__label">Contacts</h2>
          <div class="about-section__content">
            <div class="contact-grid">
              <template v-for="contact in page.contacts" :key="contact.label">
                <CopyEmailButton v-if="contact.type === 'email'" :email="contact.value">{{ contact.label }}</CopyEmailButton>
                <a v-else class="contact-link" :href="contact.href" target="_blank" rel="noreferrer">{{ contact.label }}</a>
              </template>
            </div>
          </div>
        </section>

        <!-- Download—desktop: cols 13-17, 4px top line; mobile: full-width section -->
        <div class="about-download">
          <DownloadPdfButton :href="page.resumeUrl">Download PDF-resume</DownloadPdfButton>
        </div>

        <!-- Mobile-only: Download full PDF section (4px divider + full-width button) -->
        <div class="about-download-mobile">
          <DownloadPdfButton :href="page.resumeUrl">Download full PDF-resume</DownloadPdfButton>
        </div>
      </article>
    </ScrollPane>
  </section>
</template>

<style scoped>
.about-pane {
  grid-template-rows: minmax(0, 1fr);
}

.about-view {
  display: grid;
  grid-template-columns: repeat(16, minmax(0, 1fr));
  column-gap: var(--grid-gap);
  row-gap: 0;
  padding-bottom: 58px;
}

.about-photo {
  grid-column: 1 / -1;
  height: 50vh;
  margin: 0 0 6px;
  background: var(--muted);
}

.about-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
}

/* Sections */
.about-section {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(16, minmax(0, 1fr));
  column-gap: var(--grid-gap);
  align-items: start;
  border-top: 4px solid var(--text);
  padding-top: 0;
  margin-bottom: 80px;
}

/* No line above first section (Focus) */
.about-section:first-of-type {
  border-top: none;
  padding-top: 0;
}

.about-section__label {
  grid-column: 1 / 5;
  margin: 0;
  font: inherit;
  line-height: 1.2;
}

.about-section__content {
  grid-column: 5 / 17;
}

.about-section--contact .about-section__content {
  grid-column: 9 / 17;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: var(--grid-gap);
  row-gap: 16px;
}

.contact-link {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-top: 2px solid var(--text);
  border-left: 0;
  border-right: 0;
  border-bottom: 0;
  padding: 0;
  margin: 0;
  background: none;
  font: inherit;
  line-height: 1.2;
  color: inherit;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}

.contact-link:hover {
  color: #fff;
  background-color: #000;
}

.contact-grid .contact-link:nth-child(-n + 2) {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

/* Service rows (Focus)—2px divider, 4px gap, 32px between blocks */
.service-row {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: var(--grid-gap);
  align-items: start;
  margin-bottom: 32px;
}

.service-row:last-child {
  margin-bottom: 0;
}

.service-row + .service-row {
  border-top: 2px solid var(--text);
  padding-top: 0;
}

.service-row__title {
  grid-column: 1 / 5;
}

.service-row__desc {
  grid-column: 5 / 13;
  margin: 0;
  line-height: 1.2;
}

/* Leading Team */
.about-section__content > p {
  margin: 0;
  line-height: 1.2;
}

/* Experience rows */
.exp-row {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: var(--grid-gap);
  align-items: start;
  margin-bottom: 32px;
}

.exp-row:last-child {
  margin-bottom: 0;
}

.exp-row + .exp-row {
  border-top: 2px solid var(--text);
  padding-top: 0;
}

.exp-row__company,
.exp-row__role,
.exp-row__years {
  line-height: 1.2;
}
.exp-row__company {
  grid-column: 1 / 5;
}
.exp-row__role {
  grid-column: 5 / 9;
}
.exp-row__years {
  grid-column: 9 / 13;
}

/* Download—right quarter, 4px divider */
.about-download {
  grid-column: 13 / 17;
  border-top: 4px solid var(--text);
  padding-top: 0;
}

.about-download :deep(a) {
  display: block;
  padding-top: 0;
  color: inherit;
  line-height: 1.2;
  transition: color 150ms ease, background-color 150ms ease;
}

.about-download :deep(a:hover) {
  color: #fff;
  background-color: #000;
}
</style>
