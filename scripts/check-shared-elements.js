#!/usr/bin/env node
/*
 * Shared-element drift guard.
 *
 * The site is static HTML with no build step, so things meant to be
 * identical everywhere (the logo/hover-scrub block, the graffiti
 * includes, the Google Fonts strategy, Lenis + scroll-reveal on
 * project-style pages) are copy-pasted or list-driven, not actually
 * shared at the file level. This script is a manual sanity net, not a
 * generator: it checks each page still carries every marker it's
 * supposed to, and fails loudly if a future edit updates one page (or
 * a canonical page + a bulk script) and misses another. It changes
 * nothing by itself.
 *
 * Usage:
 *   node scripts/check-shared-elements.js          # report, exit 1 if any gaps
 *   node scripts/check-shared-elements.js --hook    # same, but exit 2 + stderr
 *
 * When you add a new page, add it to the right list below. When you
 * roll out a new shared feature, add a marker to CHECKS (and to the
 * page lists it applies to).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const HOOK = process.argv.includes('--hook');

// ── Page inventory ──────────────────────────────────────────────
// Every live page gets the logo/hover-scrub + graffiti bundle.
const ALL_PAGES = [
  'index.html',
  '404.html',
  'about/index.html',
  'archive/index.html',
  'all-projects/index.html',
  'brands/index.html',
  'brands/nimax/index.html',
  'brands/ovo/index.html',
  'brands/stickerburg/index.html',
  'brands/valera/index.html',
  'inhouse/index.html',
  'inhouse/apac/index.html',
  'inhouse/crypto/index.html',
  'inhouse/dragon/index.html',
  'inhouse/finance/index.html',
  'inhouse/greenflag/index.html',
  'inhouse/identity/index.html',
  'inhouse/igaming/index.html',
  'inhouse/roadmap/index.html',
];

// Project-template pages (title + close-button header, Solution "to
// top" icon, photo gallery)—Brands and Inhouse projects only.
const PROJECT_PAGES = [
  'brands/nimax/index.html',
  'brands/ovo/index.html',
  'brands/stickerburg/index.html',
  'brands/valera/index.html',
  'inhouse/apac/index.html',
  'inhouse/crypto/index.html',
  'inhouse/dragon/index.html',
  'inhouse/finance/index.html',
  'inhouse/greenflag/index.html',
  'inhouse/identity/index.html',
  'inhouse/igaming/index.html',
  'inhouse/roadmap/index.html',
];

// Pages with a scrollable content pane but no project header/gallery
// of their own—still get Lenis + the (harmlessly-no-op) reveal script.
const SIMPLE_SCROLL_PAGES = ['about/index.html', 'archive/index.html'];

// Lenis-only (no reveal—no photo gallery here, just cards).
const LENIS_ONLY_PAGES = ['all-projects/index.html'];

// ── Markers ──────────────────────────────────────────────────────
// Each check: { name, files, pattern, hint }. `pattern` is tested with
// String#includes for plain markers or RegExp#test for regexes.
const CHECKS = [
  {
    name: 'logo hover-scrub markup (id="brand-scrub")',
    files: ALL_PAGES,
    pattern: 'id="brand-scrub"',
    hint: 'brand <a> is missing id="brand-scrub"—see any Brands page for the current markup',
  },
  {
    name: 'logo text mark (Inter wordmark, not the old logo.svg image)',
    files: ALL_PAGES,
    pattern: 'brand-mark--text',
    hint: 'still using the old <img class="brand-mark" src=".../logo.svg"> instead of the text span',
  },
  {
    name: 'all 7 brush-stroke logo variants',
    files: ALL_PAGES,
    pattern: (text) => {
      for (let i = 1; i <= 7; i++) {
        const n = String(i).padStart(2, '0');
        if (!text.includes(`logo-${n}.svg`)) return false;
      }
      return true;
    },
    hint: 'missing one or more of logo-01.svg..logo-07.svg',
  },
  {
    name: 'graffiti.css link',
    files: ALL_PAGES,
    pattern: 'graffiti.css',
    hint: 'missing <link rel="stylesheet" href="…/graffiti.css">',
  },
  {
    name: 'mobile logo text mark + swipe-to-cycle include',
    files: ALL_PAGES,
    pattern: (text) => text.includes('mobile-brand-lettering') && text.includes('mobile-logo-swipe.js'),
    hint: 'mobile-bar__brand is missing the text/lettering markup and/or the mobile-logo-swipe.js include',
  },
  {
    name: 'logo-scrub.js include',
    files: ALL_PAGES,
    pattern: 'logo-scrub.js',
    hint: 'missing <script src="…/logo-scrub.js">',
  },
  {
    name: 'graffiti.js include',
    files: ALL_PAGES,
    pattern: 'graffiti.js',
    hint: 'missing <script src="…/graffiti.js">',
  },
  {
    name: 'board-eraser wipe flag',
    files: ALL_PAGES,
    pattern: 'GRAFFITI_CLEAR_EFFECT',
    hint: "missing window.GRAFFITI_CLEAR_EFFECT = 'wipe' before graffiti.js loads",
  },
  {
    name: 'Google Fonts font-display: optional (not swap)',
    files: ALL_PAGES,
    pattern: /family=Inter[^"]*display=optional/,
    hint: 'Google Fonts link is missing or still using &display=swap—causes the font-swap "jump" on load',
  },
  {
    name: 'Lenis smooth-scroll (CSS + JS)',
    files: [...PROJECT_PAGES, ...SIMPLE_SCROLL_PAGES, ...LENIS_ONLY_PAGES],
    pattern: (text) => text.includes('lenis.css') && text.includes('lenis.min.js'),
    hint: 'missing the Lenis <link>/<script> pair—see scroll.js for the wiring it needs',
  },
  {
    name: 'scroll-reveal include (CSS + JS)',
    files: [...PROJECT_PAGES, ...SIMPLE_SCROLL_PAGES],
    pattern: (text) => text.includes('scroll-reveal.css') && text.includes('scroll-reveal.js'),
    hint: 'missing scroll-reveal.css/scroll-reveal.js',
  },
  {
    name: '"To top" Solution-icon (interactive button + shared script)',
    files: PROJECT_PAGES,
    pattern: (text) => text.includes('to-top.js') && /<button[^>]*class="pv-icon"/.test(text),
    hint: 'missing the interactive <button class="pv-icon"> (not a plain <figure>) and/or the to-top.js include',
  },
  {
    name: 'project header (title + close button)',
    files: PROJECT_PAGES,
    pattern: (text) => text.includes('content-pane__header project-header') && /<a class="close-button"/.test(text),
    hint: 'missing the <header class="content-pane__header project-header"> + close-button pattern',
  },
];

let totalGaps = 0;
const report = [];

for (const check of CHECKS) {
  for (const rel of check.files) {
    const fp = path.join(root, rel);
    if (!fs.existsSync(fp)) {
      report.push(`${rel}: listed for "${check.name}" but the file doesn't exist—stale entry in check-shared-elements.js?`);
      totalGaps++;
      continue;
    }
    const text = fs.readFileSync(fp, 'utf8');
    const ok = typeof check.pattern === 'function'
      ? check.pattern(text)
      : check.pattern instanceof RegExp
        ? check.pattern.test(text)
        : text.includes(check.pattern);
    if (!ok) {
      report.push(`${rel}: missing "${check.name}" — ${check.hint}`);
      totalGaps++;
    }
  }
}

if (totalGaps) {
  const summary = report.join('\n') +
    `\n\n✗ ${totalGaps} shared-element gap(s) found across the site. ` +
    'This means some page(s) missed a change that was meant to apply everywhere—see scripts/check-shared-elements.js to add pages or markers.';
  if (HOOK) {
    process.stderr.write(summary + '\n');
    process.exit(2);
  }
  console.log(summary);
  process.exit(1);
}
if (!HOOK) console.log(`✓ Shared elements consistent across all ${ALL_PAGES.length} pages.`);
process.exit(0);
