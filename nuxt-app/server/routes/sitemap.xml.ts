import { queryCollection } from '@nuxt/content/server'

const SITE_URL = 'https://andreyubeyvolk.com'
const STATIC_ROUTES = ['/', '/inhouse', '/brands', '/archive', '/about', '/all-projects']

export default defineEventHandler(async (event) => {
  const projects = await queryCollection(event, 'project').all()
  const projectRoutes = projects.map(p => `/${p.section}/${p.slug}`)
  const routes = [...STATIC_ROUTES, ...projectRoutes]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url><loc>${SITE_URL}${route}</loc></url>`).join('\n')}
</urlset>
`

  setHeader(event, 'Content-Type', 'application/xml')
  return body
})
