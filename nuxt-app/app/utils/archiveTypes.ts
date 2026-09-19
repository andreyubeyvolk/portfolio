// Shared shape for one archive catalog entry, used by both the desktop
// lightbox (ArchivePreview.vue) and the tablet/phone card overlay
// (ArchiveCardOverlay.vue)--both are controlled by an index into the same
// full flat `items` array (content/archive.md's 92 entries, including a
// series' continuation frames).
export interface ArchiveFlatItem {
  src: string
  width: number
  height: number
  alt: string
  title: string
  description: string
  link?: string
  tags?: string
  group?: string
  frameTitle?: string
}
