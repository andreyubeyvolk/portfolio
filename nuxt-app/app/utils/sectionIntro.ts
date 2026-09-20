export function sectionIntroText(section: 'inhouse' | 'brands'): string {
  return section === 'inhouse'
    ? 'Leading a design team. Visual systems and brand communications across every medium.'
    : 'Independent identity projects I build for external clients ready to find a voice of their own.'
}
