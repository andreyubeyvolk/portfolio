// BreadcrumbList structured data (schema.org)--tells search engines this
// page's place in the site hierarchy, purely for how a result *can* be
// displayed in search (Google sometimes renders the trail inline instead
// of a raw URL). No visible effect on the page itself: same invisible
// <script type="application/ld+json"> pattern as the Person schema on the
// home page, just injected per-page via useHead's script array (which
// merges across multiple useHead calls in one component, so this is
// additive--never touches a page's existing useHead call).
const SITE_URL = 'https://andreyubeyvolk.com'

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path.endsWith('/') ? item.path : `${item.path}/`}`,
    })),
  }
}
