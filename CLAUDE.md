# Portfolio site — project context for Claude

Portfolio for Andrey Ubeyvolk: a **Nuxt 4 + @nuxt/content** static site
in `nuxt-app/`. That folder is the whole site; nothing else in the repo
is deployed. (The old hand-written static HTML version was removed on
2026-09-28 and backed up to `D:\AI\Projects\my-new-app-static-backup\`.)

Live site: https://andreyubeyvolk.com — GitHub Pages, built by
`.github/workflows/deploy.yml` on every push to `main` (`npm ci` +
`npm run generate` in `nuxt-app/`, then uploads `.output/public`). Deploys
take ~1–3 min after push, plus CDN/browser cache — hard-refresh before
assuming a push didn't land.

## Branches / deploy flow

- Work happens on `nuxt-migration` (this checkout, `D:\AI\Projects\my-new-app`).
- `main` is checked out in a second worktree, `D:\AI\Projects\my-new-app-cutover`.
  Deploy = in that worktree: `git fetch origin && git merge origin/nuxt-migration --no-edit && git push origin main`.
- `main` alone holds `CNAME` and `.github/workflows/deploy.yml` — never delete them.
- **Always ask before pushing**, and separately before deploying to `main`.

## Structure (nuxt-app/)

```
app/pages/          index, about, archive, all-projects, inhouse|brands/{index,[slug]}
app/components/     ProjectPage (the one project template), GallerySlot, Vp (full video
                    player), VpBare (silent loop), ProjectCard/ProjectGrid, ArchivePreview
                    (desktop lightbox), ArchiveCardOverlay (tablet/phone), SiteNav, MobileNav…
app/error.vue       branded 404 (crossed-out frame) inside the default layout
app/utils/          projectOrder.ts (Next-project order), videoPoster.ts, archive helpers
app/plugins/        analytics (GA, real domain only), graffiti, legacy nav scripts, page transitions
content/            about.md, archive.md, projects/<slug>.md  (schema: content.config.ts)
public/             global CSS (styles.css desktop+tablet ≤980px, mobile.css ≤640px,
                    project-page.css, archive-page.css, …), legacy nav JS (menu.js, logo-scrub.js,
                    mobile-logo-swipe.js — injected after hydration), graffiti.js
public/assets/<section>/<slug>/   that project's media, every file prefixed with the slug
server/routes/sitemap.xml.ts      sitemap generated from the project collection
```

Two sections: **Inhouse** and **Brands** — same template, different nav
item and intro text (`utils/sectionIntro.ts`). Listings and the sitemap are
data-driven from `content/projects/*.md`.

## Naming convention

`slug-01.webp`, `slug-02.webp`… (always two digits), `slug-cover.webp|mp4`,
`slug-card.webp` (listing thumbnail, path derived from the slug),
`slug-kv.*` (Solution-block icon), `slug-og.jpg` (share preview),
`slug-project-images.zip`. Kebab-case only — rename on arrival
(`Bottom KV Foo.png` → `foo-kv.png`). NTFS is case-insensitive: to change
only casing, rename through a temp name.

## Project page anatomy

Cover → About → gallery (`wide` = one 3:2 photo, `pair` = two 3:4 photos,
`video` = standalone full player) → Challenge/Solution + KV + Download +
Next project. Mobile renders the same data flattened.

**Wide/pair is computed from each photo's pixel size, never eyeballed:**
2160×1440 → wide, 1080×1440 → portrait, consecutive portraits pair up. An
odd size (e.g. 2160×1780) is an exception — flag it and use `tall: true`
instead of cropping it into the 3:2 box.

## Video

- `player: full` (Vp: controls, starts muted) **only** if the clip has real
  audio — check with `ffmpeg -af volumedetect` (-91 dB = digital silence →
  not real audio). Everything else is VpBare: muted loop, no chrome.
- **Every video must have a same-basename `.webp` poster** next to it —
  `videoPoster()` derives it, content data never lists posters. Use the
  designer still if one exists, otherwise extract a frame:
  `ffmpeg -ss 0 -i x.mp4 -frames:v 1 -vf "scale=trunc(iw*sar/2)*2:ih,setsar=1" -c:v libwebp -quality 82 x.webp`
  (use `-ss 1` if frame 0 is black).
- Web encode: `-c:v libx264 -preset slow -crf 21-23 -pix_fmt yuv420p -movflags +faststart`,
  `-an` unless it has real audio (else `-c:a copy`). Compare with the
  original via SSIM; keep the new file only if it's meaningfully smaller at
  SSIM ≥ 0.99. Long clips already near ~2–4 Mbps don't shrink without
  visible loss — leave them.

### The anamorphic-SAR trap (always check)

Exports often have coded pixels ≠ display pixels (e.g. 1080×1080 with SAR
3:4). Standalone videos render fine; inside a fixed paired slot with
`object-fit: cover` this has repeatedly cropped wrong. Check with
`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,sample_aspect_ratio,display_aspect_ratio -of default=noprint_wrappers=1 file.mp4`
and for paired slots re-encode to square pixels at the display size:
`-vf "scale=<display_w>:<display_h>:flags=lanczos,setsar=1"`. Also rule out
baked-in black bars with `cropdetect`. HandBrake is set to
`Dimensions → Anamorphic → None`, which should prevent this — still verify.

### Cursor-follow hover captions

`tip: "Line one|Line two"` on a gallery item (see valera). Each line is its
own tight black rectangle.

## Shipping a new project — checklist

1. Assets into `public/assets/<section>/<slug>/`, renamed to convention.
2. Classify photos wide/portrait by pixel size; build the gallery sequence.
3. Videos: pick full/bare by real audio, check SAR, add a `.webp` poster.
4. `content/projects/<slug>.md` — copy a recent project file as the template;
   real About/Challenge/Solution text (dash rule below).
5. Add the slug to `app/utils/projectOrder.ts` (Next-project order).
6. `<slug>-og.jpg`: 1200×630 center crop of the cover
   (`-vf "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630" -q:v 3`).
7. **Build the download zip only at the very end**, right before pushing —
   exclude `-card`, `-kv`, `-og`, and posters/stills superseded by a video.
   Delete a stale zip rather than leaving it inconsistent.
8. `npm run generate` in `nuxt-app/`, check in the browser, then ask before pushing.

## House rules

- **Em/en dash never takes surrounding spaces** — titles and prose. (The old
  enforcement hook was removed with the static site; check manually, e.g.
  `grep -rnE " [—–] " nuxt-app/content nuxt-app/app`.)
- **font-size in `rem`** (px ÷ 16), `line-height` unitless; everything else
  in `px`. Figma values arrive in px — convert on the way in.
- **Paragraph gap is 8px** everywhere text stacks paragraph-under-paragraph
  (section intros, About blocks) — never override with `margin: 0`.
- **One gray for secondary text: `var(--muted-text)` (#6e6e6e)** — passes
  WCAG AA on both the page background and white plaques. Don't add others.
- Mobile menu dims the page with one veil on `.menu-overlay`
  (#E8E8E8 at 91% + 5% grain) — not per-element opacity.
- Never commit scratch/prototype files or `.xmp` sidecars from Adobe exports.
- Match a file's existing line endings (LF vs CRLF) in scripted bulk edits.

## Current project roster

`app/utils/projectOrder.ts` is authoritative — don't trust prose here.
