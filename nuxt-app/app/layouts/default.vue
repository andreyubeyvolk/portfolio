<template>
  <main class="site-shell page-grid">
    <SiteNav />
    <slot />
  </main>

  <!-- Page-level mobile-only markup (e.g. ProjectPage.vue's
       .project-bar/.mobile-project) teleports to "#teleports" instead of
       a custom target div here—see ProjectPage.vue's own comment on why
       it needs to be a sibling of <main>, not a descendant of it. Nuxt's
       SSR renderer only ever splices two teleport targets into the actual
       HTML string: "body", and this one reserved "#teleports" container
       (nuxt.config's app.teleportId, default "teleports", rendered by
       Nuxt itself right before </body>). Any OTHER custom selector--like
       the "#mobile-page-content" div this used to be--gets silently
       dropped during SSR (Vue still computes the teleported content into
       ssrContext.teleports, nitro's renderer.mjs just never reads that
       key), which doesn't break the static `nuxi generate` output itself
       but does cause a real hydration mismatch in the dev server/any SSR
       response: the server HTML has zero children there while the
       client's post-hydration render has the full mobile markup. -->
  <MobileNav />
</template>
