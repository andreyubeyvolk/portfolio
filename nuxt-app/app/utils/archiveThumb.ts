// Every archive image has a same-basename -thumb.webp next to it (640px
// wide, scaled down from the full-size original)--derived, never listed
// per item in content data, same pattern as videoPoster(). Grid cards use
// this; the lightbox/swipe views use the original (item.src) directly,
// since that's the one place the full resolution is actually needed.
export function archiveThumb(src: string) {
  return src.replace(/\.webp$/i, '-thumb.webp')
}
