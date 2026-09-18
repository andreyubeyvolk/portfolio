<template>
  <main class="site-shell page-grid">
    <SiteNav />
    <slot />
  </main>

  <!-- Teleport target for page-level mobile-only markup (e.g.
       ProjectPage.vue's .project-bar/.mobile-project) that needs to be a
       sibling of <main>, not a descendant of it—<main> is display:none on
       mobile, which would hide anything left nested inside it via <slot />
       above regardless of that content's own display value. -->
  <div id="mobile-page-content" />

  <MobileNav />
</template>
