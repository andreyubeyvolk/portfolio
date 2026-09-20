// The content-pane curtain for section<->project navigation (every
// project except the cover-morph test slugs--see
// plugins/page-transition.client.ts). Both the listing's .content-pane
// and the project page's .content-pane carry the SAME
// view-transition-name during that one navigation, so the browser pairs
// them into one group and page-transitions.css's curtain keyframes wipe
// within that shared box--conditional on the current transition type,
// for the same reason the cover morph's name is conditional (an
// always-on name would leak into every OTHER transition these same
// elements are part of, e.g. the section-to-section curtain).
export function usePanelTransitionStyle() {
  const type = useState<string>('pageTransitionType', () => 'none')
  return computed(() => {
    return (type.value === 'project-open-panel' || type.value === 'project-close-panel')
      ? { viewTransitionName: 'content-pane' }
      : undefined
  })
}
