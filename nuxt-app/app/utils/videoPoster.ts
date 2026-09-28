// Every video under public/assets has a same-basename .webp next to it
// (a designer still where one existed, otherwise a frame extracted from
// the video itself)--so the poster path is derived, never listed per
// video in content data. Keep that invariant when adding a new video.
export function videoPoster(src: string) {
  return src.replace(/\.mp4$/i, '.webp')
}
