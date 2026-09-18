import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: { include: '**', exclude: ['about.md'] },
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
  },
})
