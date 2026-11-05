// Builds the data for the /mix mosaic: a small webp thumb per portfolio photo
// (public/assets/mix/<section>/<slug>/<name>.webp; Archive cards reuse their own
// -thumb.webp) and a manifest of them (public/assets/mix/manifest.json). Every
// manifest entry carries the link a click should follow: a project page with
// ?img=<file stem> (the page scrolls to that photo), or /archive?open=<index>
// (the Archive opens that picture in its lightbox). Run after adding or changing a project:
//   node scripts/make-mix-thumbs.mjs
// Only missing thumbs are rendered; delete public/assets/mix to rebuild all.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const projectsDir = join(root, 'content', 'projects')
const outDir = join(publicDir, 'assets', 'mix')

const SKIP = /-(kv|card|og|preview)\.[a-z0-9]+$/i
const LANDSCAPE_W = 960
const PORTRAIT_W = 640

// A video tile normally shows the video's own poster (its first frame). Where that
// frame is empty, name the video here (by its poster path) and the fraction of its
// length to take the thumb from instead.
const FRAME_AT = {
  '/assets/inhouse/igaming/igaming-video.webp': 0.45,
}

const manifest = []
const seen = new Set()

for (const file of readdirSync(projectsDir).filter(f => f.endsWith('.md')).sort()) {
  const text = readFileSync(join(projectsDir, file), 'utf8')
  const front = text.split(/^---\s*$/m)[1] ?? ''
  const slug = /^slug:\s*(\S+)/m.exec(front)?.[1]
  const section = /^section:\s*(\S+)/m.exec(front)?.[1]
  const title = /^title:\s*(.+)$/m.exec(front)?.[1]?.trim().replace(/^["']|["']$/g, '')
  if (!slug || !section || !title) continue
  if (/^comingSoon:\s*true/m.test(front)) continue

  for (const m of front.matchAll(/^\s*src:\s*(\/assets\/\S+\.(?:webp|mp4))\s*$/gm)) {
    const original = m[1]
    let src = original
    if (SKIP.test(src)) continue
    if (src.endsWith('.mp4')) src = src.replace(/\.mp4$/i, '.webp')
    if (seen.has(src)) continue
    seen.add(src)

    const input = join(publicDir, src)
    if (!existsSync(input)) { console.warn('missing source', src); continue }

    const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', input]).toString().trim()
    const [w, h] = probe.split('x').map(Number)
    const ratio = w / h
    const orientation = ratio >= 1.4 ? 'landscape' : ratio <= 0.8 ? 'portrait' : ratio >= 0.9 && ratio <= 1.15 ? 'square' : null
    if (!orientation) { console.warn('skipping odd ratio', src, `${w}x${h}`); continue }

    const thumbRel = src.replace('/assets/', '/assets/mix/')
    const thumb = join(publicDir, thumbRel)
    const frameAt = original.endsWith('.mp4') ? FRAME_AT[src] : undefined
    if (frameAt !== undefined || !existsSync(thumb)) {
      mkdirSync(dirname(thumb), { recursive: true })
      const width = orientation === 'landscape' ? LANDSCAPE_W : PORTRAIT_W
      const scale = `scale=${width}:-2:flags=lanczos`
      if (frameAt !== undefined) {
        const mp4 = join(publicDir, original)
        const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString())
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(duration * frameAt), '-i', mp4, '-frames:v', '1', '-vf', `scale=trunc(iw*sar/2)*2:ih,setsar=1,${scale}`, '-c:v', 'libwebp', '-quality', '74', thumb])
      } else {
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-vf', scale, '-c:v', 'libwebp', '-quality', '74', thumb])
      }
    }
    const stem = basename(src).replace(/\.[^.]+$/, '')
    manifest.push({ src: thumbRel, o: orientation[0], title, to: `/${section}/${slug}?img=${stem}` })
  }
}

// Archive cards: one tile per grid card (a series' extra frames stay in the lightbox)
{
  const text = readFileSync(join(root, 'content', 'archive.md'), 'utf8')
  const front = text.split(/^---\s*$/m)[1] ?? ''
  const chunks = front.split(/^  - src:\s*/m).slice(1)
  chunks.forEach((chunk, index) => {
    if (!/^\s+isCard:\s*true/m.test(chunk)) return
    const src = chunk.split(/\r?\n/)[0].trim()
    const w = Number(/^\s+width:\s*(\d+)/m.exec(chunk)?.[1])
    const h = Number(/^\s+height:\s*(\d+)/m.exec(chunk)?.[1])
    const title = /^\s+title:\s*(.+)$/m.exec(chunk)?.[1]?.trim().replace(/^["']|["']$/g, '').replace(/\[[^\]]*\]$/, '')
    const thumbRel = src.replace(/\.webp$/i, '-thumb.webp')
    if (!title || !w || !h || !existsSync(join(publicDir, thumbRel))) { console.warn('skipping archive item', src); return }
    const ratio = w / h
    const o = ratio >= 1.4 ? 'l' : ratio <= 0.8 ? 'p' : ratio >= 0.9 && ratio <= 1.15 ? 's' : null
    if (!o) { console.warn('skipping odd ratio', src, `${w}x${h}`); return }
    manifest.push({ src: thumbRel, o, title, to: `/archive?open=${index}` })
  })
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest))
const count = k => manifest.filter(x => x.o === k).length
console.log(`${manifest.length} tiles (${count('l')} landscape, ${count('p')} portrait, ${count('s')} square)`)
