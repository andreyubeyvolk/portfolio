# Portfolio — Project Roadmap

## Current State

Static HTML/CSS/JS portfolio. Desktop and mobile layouts built. One project page (Stickerburg) fully implemented. All main sections exist as pages.

Stack: vanilla HTML + CSS + JS. No framework, no build step.
Next milestone: finish all content in HTML → then migrate to Nuxt.

---

## Implementation Phases

### Phase 1 — Stabilize desktop prototype ✅ DONE
- 24-column grid, custom scrollbar, navigation behavior
- Home page: reel, portrait, social links
- Inhouse, Brands, Archive, About pages built
- Project page template (Stickerburg as reference)
- Active nav state, hover underlines, close button behavior

### Phase 2 — Mobile layouts ✅ DONE
- Mobile nav bar, mobile menu overlay
- All sections adapted for mobile: Home, Inhouse, Brands, Archive, About
- Mobile project page: Stickerburg
- Load more pagination (Inhouse, Brands, Archive)
- Archive card preview on mobile (overlay)
- Consistent background dimming on card open (mobile + desktop)

### Phase 3 — Finish HTML content 🔄 IN PROGRESS
- Fill remaining Inhouse project pages (currently only Stickerburg done)
- Fill remaining Brands project pages
- Add real Archive cards with actual images
- Add AI section (new menu item) — see Routes below
- Finalize About content
- Replace all placeholder images (cap.jpg, laptop.jpg, etc.)

### Phase 4 — Migrate to Nuxt
- Create Nuxt project, move CSS into assets
- Build layout components (shell, nav, content pane, scrollbar)
- Implement routes matching the route plan below
- Move nav, projects, archive to local data files
- Add page/layout transitions (fade, curtain — the main reason for Nuxt)
- Preserve desktop layout pixel-exactly before adding any new behavior

### Phase 5 — Interactions & animations
- Route/page transitions (fade ~250ms or curtain effect)
- Project open/close animation
- Archive item open/close animation
- Custom reel video player (play/pause, progress, mute, fullscreen)
- GSAP or Motion One for complex transitions

### Phase 6 — Content system (optional)
- Decision: local data files vs Nuxt Content vs Sanity
- Only after content model is fully stable
- Sanity if non-code editing (image upload, crop, hotspot) becomes needed

---

## Routes

```
/                   Home / reel
/inhouse            Inhouse project grid
/inhouse/[slug]     Single inhouse project
/brands             Brands project grid
/brands/[slug]      Single brand project
/archive            Archive grid
/about              About page
/ai                 AI projects, plugins, tools, experiments (future)
```

Note: each opened project needs its own URL. Visually it opens inside the right content pane (columns 9–24), but the URL changes.

---

## Sections

### Inhouse
In-house work: brand identity, campaigns, design systems, team leadership.
Grid of project cards → click opens project in right pane.
Each project = own slug + own page.

### Brands
Brand/client projects. Same interaction model as Inhouse.

### Archive
Smaller focused works, visual explorations, AI experiments, selected references.
Grid of image cards → click opens card preview (image + title + description).
Cards added frequently — should be data-driven in Nuxt.

### About
Personal page: focus areas, experience, open to, contacts, PDF resume download.

### AI (planned)
Separate menu section for AI-related work:
presentations, plugins, effects, utilities, process documentation, downloadable files.
May use a different card layout (file/download-oriented vs image-oriented).
Add as 5th nav item with slight visual separation from the main four.

---

## Asset Convention

```
assets/
  logo.svg                          Brand logo (used everywhere)
  portrait.jpg                      Home page portrait
  reel.jpg / reel-icon.svg          Home page reel
  about-hero.jpg                    Placeholder (replace)
  inhouse/
    [slug]/
      [slug]-cover.jpg              Main cover image
      [slug]-about.jpg              Intro/about thumbnail
      [slug]-photo-01.jpg           Body photos, numbered
      [slug]-photo-02.jpg
      [slug]-icon.png               Project logo/icon if exists
  brands/
    [slug]/                         Same naming convention as inhouse
  archive/
    archive-[description].jpg       Archive images, descriptive name
  about/
    (portrait and assets specific to about page)
```

Rule: always prefix project files with the project slug.
Reason: unique filenames across the whole project, safe to download as a zip, no collision if all images are in one folder.

---

## Desktop Layout

24-column grid.

- Page margin: 16px
- Grid gutter: 16px
- Columns 1–4: logo + nav
- Columns 5–8: section intro text
- Columns 9–24: content pane (scrollable)

Typography:
- Font: Inter
- Base: 16px / 20px line-height
- Letter spacing: 0 (section labels: –0.02em)

Visual rules:
- Background: #F5F4F4
- Text: #171717
- No rounded UI unless forced by media
- No gradients (subtle black overlay on video controls is ok)
- No decorative effects
- Editorial, grid-based, minimal

Scrollbar (content pane):
- 4px outer space + 8px black thumb + 4px inner space
- No rounded corners, no arrows
- Implemented via scroll.js + custom WebKit styles

---

## Navigation

Desktop:
- 4 items: Inhouse, Brands, Archive, About
- Active item: italic
- Hover: underline animates left to right
- Logo: click → home, hover → opacity ~0.7
- Future 5th item (AI): same nav, slight extra top spacing to separate it visually

Mobile:
- Bottom bar: logo left, Menu button right
- Menu opens as overlay from bottom
- Menu contains same section links
- Project pages: fixed top bar with project title + close button

---

## Project Content Model (for Nuxt later)

```ts
type Project = {
  title: string
  slug: string
  section: 'inhouse' | 'brands'
  description?: string
  cover: string         // filename in assets/[section]/[slug]/
  about?: string        // thumbnail filename
  icon?: string         // icon/logo filename
  challenge?: string
  solution?: string
  photos: string[]      // photo-01, photo-02, ...
}
```

Block types for flexible project layouts:
```ts
type ProjectBlock =
  | { type: 'cover';  src: string }
  | { type: 'about';  thumb: string; text: string }
  | { type: 'pair';   photos: [string, string] }
  | { type: 'wide';   src: string }
  | { type: 'info';   challenge: string; solution: string; icon?: string }
```

---

## Transitions (Nuxt Phase)

Main reason for Nuxt: page transitions are not possible in clean HTML without complex JS hacks.

Planned:
- Route change: fade 200–300ms (start simple)
- Project open/close: possible curtain or slide from right
- Archive card open/close: expand from card position or fade overlay
- GSAP hooks: `onBeforeLeave` / `onEnter` for complex sequences

Start simple (opacity fade), refine after migration is stable.

---

## Data Structure (Nuxt Phase)

```
data/
  nav.ts          Menu items and routes
  projects.ts     All inhouse + brands projects
  archive.ts      All archive items
  about.ts        About page content
  ai.ts           AI section content
```

CMS decision (Phase 6):
- Nuxt Content: if content stays in files, no external editing needed
- Sanity: if image upload, crop, hotspot, non-code editing becomes important
- Do not add CMS until content model is 100% stable

---

## Open Decisions

- Tablet breakpoint behavior (compact logo, column collapse)
- Reel video hosting: local file, Vimeo API, Mux, or CDN
- Video quality selector approach
- AI section card layout (download-oriented vs image-oriented)
- Whether archive items need their own full URL or overlay-only is enough
- Sanity vs Nuxt Content vs local data files

---

## Progress Log

### 2026-04-21
- Started roadmap
- Built 24-column grid, custom scrollbar, nav behavior
- Added structural CSS classes: site-shell, section-intro, content-pane, custom-scroll
- Built home page: reel, portrait, social links
- Added static routes: inhouse/index.html, inhouse/stickerburg/index.html

### 2026-06-13
- Phase 1 complete, Phase 2 complete
- Built mobile layouts for all sections (Home, Inhouse, Brands, Archive, About)
- Mobile nav: bottom bar, menu overlay, project bar
- Stickerburg project page: full desktop layout (pv-* CSS system) + mobile layout
- Archive card preview: desktop (overlay in content pane) + mobile (fixed overlay)
- Consistent background dimming on card open (mobile + desktop)
- Load more pagination: Inhouse, Brands, Archive
- Asset restructure: project files prefixed with slug, logo.svg renamed, cyrillic filenames removed
- Added .gitignore, git tag v0.1-mobile-complete
- Decided: finish all content in HTML first, then migrate to Nuxt
