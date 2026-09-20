// Canonical, hand-maintained order of REAL (published) project pages per
// section, ported from the static site's project-order.js (a
// window-global there since every page loaded it as a plain <script>;
// here it's just an importable module). Controls the Next-project chain
// (see NextProjectButton.vue)—when a new project ships, add its slug to
// the matching array, in the order it should appear in that sequence.
export const PROJECT_ORDER: Record<'inhouse' | 'brands', string[]> = {
  inhouse: ['igaming', 'crypto', 'finance', 'identity', 'greenflag', 'apac', 'roadmap', 'dragon'],
  brands: ['nimax', 'stickerburg', 'valera', 'ovo'],
}
