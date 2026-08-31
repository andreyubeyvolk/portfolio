#!/usr/bin/env node
// Detects Archive images whose edges are close in color to the page
// background (#F5F4F4) — these visually "merge" with the page and benefit
// from a subtle 1px outline. Samples a thin strip along each of the 4 edges
// (averaged down to a single pixel via ffmpeg), compares each to the
// background in RGB space, and flags the file if at least 3 of 4 edges are
// within the threshold distance.
//
// Usage:
//   node scripts/detect-blend-outline.js                 # scan assets/archive
//   node scripts/detect-blend-outline.js path/to/folder   # scan another folder
//   node scripts/detect-blend-outline.js --apply          # also patch archive/index.html,
//                                                          # adding class="has-outline" to
//                                                          # flagged <img data-preview> tags

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BG = [245, 244, 244]; // page background — see styles.css :root
const EDGE_STRIP = 6; // px sampled along each edge
const DISTANCE_THRESHOLD = 25; // RGB Euclidean distance below which an edge "reads as" background
const MIN_EDGES_CLOSE = 3; // out of 4, to flag the whole image

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const folderArg = args.find((a) => !a.startsWith('--'));
const folder = path.resolve(folderArg || path.join(__dirname, '..', 'assets', 'archive'));

function sampleEdge(file, crop) {
  const out = execFileSync('ffmpeg', [
    '-y', '-i', file,
    '-vf', `${crop},scale=1:1`,
    '-frames:v', '1',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24',
    '-',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
  return [out[0], out[1], out[2]];
}

function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function checkFile(file) {
  const edges = {
    top: `crop=iw:${EDGE_STRIP}:0:0`,
    bottom: `crop=iw:${EDGE_STRIP}:0:ih-${EDGE_STRIP}`,
    left: `crop=${EDGE_STRIP}:ih:0:0`,
    right: `crop=${EDGE_STRIP}:ih:iw-${EDGE_STRIP}:0`,
  };
  const distances = {};
  let closeCount = 0;
  for (const [name, crop] of Object.entries(edges)) {
    const rgb = sampleEdge(file, crop);
    const d = dist(rgb, BG);
    distances[name] = Math.round(d * 10) / 10;
    if (d < DISTANCE_THRESHOLD) closeCount++;
  }
  return { distances, closeCount, flagged: closeCount >= MIN_EDGES_CLOSE };
}

const exts = new Set(['.webp', '.jpg', '.jpeg', '.png']);
const files = fs.readdirSync(folder).filter((f) => exts.has(path.extname(f).toLowerCase()));

const flagged = [];
for (const f of files) {
  const full = path.join(folder, f);
  try {
    const result = checkFile(full);
    if (result.flagged) flagged.push(f);
    const mark = result.flagged ? 'FLAG ' : '     ';
    console.log(`${mark}${f}  ${JSON.stringify(result.distances)}`);
  } catch (e) {
    console.log(`ERROR ${f}: ${e.message}`);
  }
}

console.log('');
console.log(`${flagged.length} of ${files.length} images flagged (blend with background):`);
flagged.forEach((f) => console.log('  ' + f));

if (apply) {
  const htmlPath = path.join(__dirname, '..', 'archive', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  let changed = 0;
  for (const f of flagged) {
    // Match this file's <img ...> tag (data-preview cards) and add
    // class="has-outline" right after the tag name, unless already present.
    const re = new RegExp(`(<img(?![^>]*class=)[^>]*src="[^"]*${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>)`);
    if (re.test(html)) {
      html = html.replace(re, (m) => m.replace('<img ', '<img class="has-outline" '));
      changed++;
    }
  }
  fs.writeFileSync(htmlPath, html);
  console.log('');
  console.log(`--apply: patched ${changed} <img> tag(s) in archive/index.html`);
}
