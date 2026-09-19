import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: { include: '**', exclude: ['about.md', 'projects/**'] },
    }),
    // Structured data, not prose—the 'page' type only keeps a fixed set of
    // fields (title/description/body/...) and buries everything else
    // under `.meta`. A real schema instead gets these fields validated and
    // available at the top level, and is the pattern every future project
    // page (Stage 4) will reuse.
    about: defineCollection({
      type: 'data',
      source: 'about.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        intro: z.object({
          heading: z.string(),
          text: z.string(),
        }),
        photo: z.string(),
        approach: z.array(z.object({ title: z.string(), desc: z.string() })),
        focus: z.array(z.object({ title: z.string(), desc: z.string() })),
        leadingTeams: z.string(),
        experience: z.array(z.object({
          company: z.string(),
          role: z.string(),
          years: z.string(),
        })),
        openTo: z.string(),
        portrait: z.string(),
        contacts: z.array(z.object({
          label: z.string(),
          type: z.string().optional(),
          value: z.string().optional(),
          href: z.string().optional(),
        })),
        resumeUrl: z.string(),
      }),
    }),
    // One project-page template (see components/ProjectPage.vue) driven
    // entirely by this data—no per-project template copy-paste, which is
    // the actual point of the migration for these 12 pages. `gallery` is
    // the same wide/pair/video sequence already worked out by hand on the
    // static site (CLAUDE.md's mechanical wide/pair classification from
    // each photo's pixel dimensions)--carried over as-is, not re-derived.
    project: (() => {
      const mediaItem = z.object({
        type: z.enum(['image', 'video']),
        src: z.string(),
        width: z.number(),
        height: z.number(),
        alt: z.string().optional(),
        note: z.string().optional(),
        player: z.enum(['bare', 'full']).optional(),
      })
      return defineCollection({
        type: 'data',
        source: 'projects/**/*.md',
        schema: z.object({
          slug: z.string(),
          section: z.enum(['inhouse', 'brands']),
          title: z.string(),
          description: z.string(),
          cover: mediaItem,
          about: z.string(),
          gallery: z.array(z.union([
            z.object({ type: z.literal('wide'), item: mediaItem }),
            z.object({ type: z.literal('pair'), items: z.tuple([mediaItem, mediaItem]) }),
            // A standalone full-width video player--natural aspect ratio,
            // not cropped into a pv-wide/pv-pair box. Only ever `player:
            // 'full'` in practice (a silent clip would just be cover-style
            // .vp-bare inside a wide/pair slot instead), but not enforced,
            // since nothing stops a future project from wanting a
            // full-width silent standalone clip either.
            z.object({ type: z.literal('video'), item: mediaItem }),
          ])),
          challenge: z.string(),
          solution: z.string(),
          // Not a fixed 206x206 everywhere--igaming's KV is 246x257. Real
          // width/height (not just src) so KvIcon renders at its actual
          // aspect instead of a hardcoded square.
          kv: z.object({
            src: z.string(),
            width: z.number(),
            height: z.number(),
          }),
          zipUrl: z.string().optional(),
        }),
      })
    })(),
  },
})
