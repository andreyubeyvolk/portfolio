// Bakes the flat version of the Sumsub photo album (public/albums/sumsub/flat/
// sNN.webp): a picture of the closed album (s00), of every spread (s01..s18) and
// of the back cover (s19), rendered by the 3D album page itself in headless
// Chrome at the embed's own 2160x1440 and saved as webp. The flat page
// (flat/index.html) shows these instead of the 3D book.
//
// Needs the site served somewhere (the dev server is enough) and Chrome + ffmpeg:
//   node scripts/bake-flat.mjs            # against http://localhost:3002
//   node scripts/bake-flat.mjs http://localhost:3000
// Then bump ?v= on the album in content/projects/sumsub.md.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'albums', 'sumsub', 'flat')
const base = process.argv[2] || 'http://localhost:3002'
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!CHROME) throw new Error('Chrome not found')

// Frames in the order the flat page shows them; `at` is the 3D page's own ?at= value.
const config = JSON.parse(readFileSync(join(outDir, '..', 'config.json'), 'utf8'))
const spreads = config.pages?.length || 18
const frames = [{ at: '0' }, ...Array.from({ length: spreads }, (_, i) => ({ at: String(i + 1) })), { at: 'back' }]

const W = 2160, H = 1440, QUALITY = 78
const tmp = mkdtempSync(join(tmpdir(), 'bake-flat-'))
mkdirSync(outDir, { recursive: true })
let total = 0
frames.forEach((f, i) => {
  const name = `s${String(i).padStart(2, '0')}`
  const png = join(tmp, name + '.png')
  const url = `${base}/albums/sumsub/index.html?embed=1&at=${f.at}&bake=${Date.now()}`
  execFileSync(CHROME, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(tmp, 'profile')}`,
    `--window-size=${W},${H}`, '--force-device-scale-factor=1', '--hide-scrollbars',
    // virtual time lets the page's own timers and image loads run to completion before the shot
    '--virtual-time-budget=20000', `--screenshot=${png}`, url,
  ], { stdio: 'ignore' })
  const webp = join(outDir, name + '.webp')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', String(QUALITY), webp])
  const kb = Math.round(statSync(webp).size / 1024)
  total += kb
  console.log(`${name}.webp  at=${f.at.padEnd(4)} ${kb} KB`)
})
rmSync(tmp, { recursive: true, force: true })
console.log(`${frames.length} frames, ${Math.round(total / 1024 * 10) / 10} MB`)
