# Portfolio Project Roadmap

## Purpose

This file is the working memory for the portfolio site. Read it at the start of each session before making structural changes.

Current state:
- Static HTML/CSS prototype.
- Main files: `index.html`, `styles.css`, `assets/`.
- The current visual direction is worth preserving: minimal, precise, editorial, grid-based.
- Do not multiply pages by copy-pasting full HTML layouts. Shared layout, navigation, scroll, video, and content patterns should become reusable.

## Progress Log

### 2026-04-21

- Added this roadmap.
- Started turning the static prototype into future component-shaped HTML/CSS.
- Added structural classes:
  - `site-shell`
  - `section-intro`
  - `content-pane`
  - `content-pane__header`
  - `content-pane__scroll`
  - `project-view`
  - `social-links`
- Extracted reusable scrollbar styling into `.custom-scroll`.
- Added active menu italic style through `.nav-list a.is-active`.
- Added static route prototype:
  - `inhouse/index.html`
  - `inhouse/stickerburg/index.html`
- Refined scrollbar sizing variables:
  - `--scrollbar-thumb-width`
  - `--scrollbar-track-padding`
  - `--scrollbar-gutter`
- Native Chrome/Windows scrollbar styling was not enough for the desired sharp black rectangle. Started custom visual scrollbar in `scroll.js`, with native scroll hidden inside `.custom-scroll`.
- Replaced root `index.html` with home page prototype:
  - intro text and portrait;
  - reel poster with custom play/title assets;
  - two-column social links under reel.
- Added home assets:
  - `assets/reel.jpg`
  - `assets/portrait.jpg`
  - `assets/reel-icon.svg`
  - `assets/reel-text.svg`

## Core Direction

Build the site first as a stable visual prototype, then migrate it to Nuxt as a component system.

Do not migrate to Nuxt before the base desktop composition, scroll behavior, navigation behavior, and reel behavior are clear enough.

Target stack later:
- Nuxt for routing, layouts, reusable components, transitions, and future CMS integration.
- Local content data first.
- Consider Nuxt Content or Sanity only after project fields and archive behavior are stable.

## Desktop Layout

Use a 24-column grid.

Base geometry:
- Page margin: `16px`.
- Grid gutter: `16px`.
- Columns `1-4`: fixed logo and menu.
- Columns `5-8`: section info block.
- Columns `9-24`: main content pane.

Typography:
- Font: Inter for now.
- Base text: `16px`.
- Base line-height: `20px`.
- Letter spacing: `0`.

Visual rules:
- White background.
- Black text.
- No decorative cards.
- No rounded UI unless needed by a specific media asset.
- No gradients except possible subtle black overlay for video controls.
- Keep layout editorial and precise.

## Routes

Future Nuxt routes should support shareable URLs while preserving the same visual layout.

Planned routes:

```text
/                         Home / reel
/inhouse                  Inhouse project list
/inhouse/[slug]           Open inhouse project
/brands                   Brands project list
/brands/[slug]            Open brand project
/archive                  Archive grid
/archive/[slug]           Open archive item
/about                    About page
```

Important routing decision:
- Projects should not be only internal state inside `/inhouse` or `/brands`.
- Each opened project needs its own URL.
- Visually, the opened project still appears inside the right content pane, columns `9-24`.

## Navigation

Final desktop menu:
- Inhouse
- Brands
- Archive
- About

Logo:
- Click returns to `/`.
- Hover opacity: about `60-70%`.

Menu behavior:
- Active section is italic.
- Hover underline animates left to right.
- Current structure should allow a future fifth menu item.
- Future special item may be visually separated by extra spacing.

Future data shape:

```ts
[
  { label: 'Inhouse', to: '/inhouse' },
  { label: 'Brands', to: '/brands' },
  { label: 'Archive', to: '/archive' },
  { label: 'About', to: '/about' }
]
```

Possible later special item:

```ts
{ label: 'Special', to: '/special', group: 'secondary' }
```

## Home Page

Home is a separate start page and is not listed as a menu item.

Desktop composition:
- Columns `1-4`: logo and menu.
- Columns `5-8`: short personal/section text plus small square photo.
- Columns `9-24`: video showreel.
- Under the reel: text social links.

Future optional additions:
- Banner below social links, for example PDF report download.
- Small photo interaction: hover/click may expand into vertical video or another compact media component.

Home reel:
- No visible frame.
- Center play icon plus word `Reel`.
- Existing source assets mentioned by user:
  - `C:/Users/User/Downloads/Reel text.svg`
  - `C:/Users/User/Downloads/Reel icon.svg`
- Later move these into project assets, likely `public/icons/` in Nuxt.

## Video Player

Use a custom player over native HTML5 video.

Required controls:
- Play/pause.
- Loading/progress bar.
- Volume/mute.
- Quality selector.
- Fullscreen/expand.
- Collapse/close from fullscreen.
- Esc should close fullscreen if possible.

Visual direction:
- Minimal white controls.
- Controls appear near bottom, likely on hover.
- A subtle black gradient behind controls is acceptable for readability.
- Start state is only play triangle plus `Reel` in the center.

Implementation notes:
- For full custom controls, prefer direct video files with multiple qualities.
- Vimeo iframe limits control customization.
- Later component name: `ReelPlayer.vue`.

## Scroll

Scroll is a site-level behavior, not a project-specific hack.

Where it appears:
- Main content pane when page/project content exceeds viewport height.
- Nested project/archive content blocks if needed.

Visual:
- White track/background.
- No arrows at top or bottom.
- Thumb is a black rectangle.
- No rounded corners.
- Standard browser scroll mechanics.

Geometry:
- Right side should feel like: `4px` outer space + `8px` black scrollbar + `4px` inner space before content.
- Scrollbar belongs inside the right content area, not outside the page margin.

Future CSS abstraction:

```css
.custom-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: auto;
  scrollbar-color: #000 #fff;
}
```

All scrollable panes should use a shared class or `CustomScroll` component later.

## Sections

### Inhouse

Purpose:
- In-house projects.

Behavior:
- Section page shows project cards/list inside columns `9-24`.
- Clicking a project opens it inside the same right content pane.
- URL must become `/inhouse/[slug]`.
- Project content can scroll vertically.

### Brands

Purpose:
- Side projects / brand projects.

Behavior:
- Same interaction model as Inhouse.
- URL must become `/brands/[slug]`.

### Archive

Purpose:
- Smaller focused works, selected projects, visual explorations, experiments across design, AI, and other mediums.

Index behavior:
- Right content pane contains card grid.
- Cards are usually 4 columns wide.
- Card has image plus caption.

Open item behavior:
- Clicking a card opens image/item inside the right content pane.
- URL must become `/archive/[slug]`.
- Open item has title and close button at top.
- Vertical images scale by width/columns; height follows image.
- Horizontal images can span about 14 columns to visually crop/interfere with lower cards.

### About

Purpose:
- Personal/about page.

Content:
- Photos.
- Text.
- Possibly reel/video.
- Social links.

Structure:
- Similar to project page/content pane model.

## Project Content Model

Projects should be data-driven later.

Possible project fields:

```ts
type Project = {
  title: string
  slug: string
  section: 'inhouse' | 'brands'
  description?: string
  cover: MediaItem
  content: ProjectBlock[]
}
```

Possible block types:

```ts
type ProjectBlock =
  | { type: 'image'; src: string; alt: string; span: 8 | 16; ratio?: string }
  | { type: 'video'; src: string; poster?: string; span: 8 | 16 }
  | { type: 'text'; text: string; span: 8; style?: 'body' | 'large' }
  | { type: 'split'; media: MediaItem; text: string }
```

Do not lock project pages into one rigid template. Keep enough structure for:
- 8-column media.
- 16-column media.
- Text blocks.
- Split media/text rows.
- Videos.

## Responsive Plan

Desktop:
- 24-column layout.
- Left menu fixed.
- Section info fixed in columns `5-8`.
- Content scrolls in columns `9-24`.

Tablet:
- Needs design exploration.
- Possible compact logo variant.
- Long logo may switch to two-line/stacked logo.
- Do not squeeze text columns until they become ugly.

Mobile:
- Top white bar.
- Logo on left.
- `[menu]` text or icon on right.
- Menu opens fullscreen.
- Menu contains section links.
- Mobile fullscreen menu may include social links at bottom.
- Content becomes single-column/full-width.

Assets to consider:
- `logo-wide.svg`.
- `logo-stacked.svg`.

## Transitions

Desired direction:
- Soft page/content fade.
- No heavy animation at first.
- Later: animated video fullscreen expand/collapse.
- Later: project/archive item opening animation if it fits the design.

Nuxt later:
- Use page/layout transitions for route changes.
- Start with simple opacity transition around `200-300ms`.

## CMS / Content Editing

Do not add Sanity immediately.

Recommended phases:
1. Static HTML/CSS prototype.
2. Nuxt with local data files.
3. Add Nuxt Content or Sanity only after content fields are stable.

Local data first:

```text
data/
  nav.ts
  home.ts
  projects.ts
  archive.ts
  about.ts
```

CMS decision later:
- Nuxt Content if content can live in markdown/data files.
- Sanity if image uploading, admin editing, crop/hotspot, and non-code content updates become important.

## Implementation Phases

### Phase 1 - Stabilize Current Prototype

- Preserve current desktop visual direction.
- Finish custom scrollbar as reusable system class.
- Clean current CSS into clearer sections.
- Make current nav rules match final behavior:
  - active item italic;
  - hover underline;
  - logo hover opacity.
- Build/adjust home page layout with reel composition.
- Keep changes scoped; do not introduce Nuxt yet unless explicitly decided.

### Phase 2 - Define Reusable Static Patterns

- Separate layout concepts in HTML/CSS:
  - site shell;
  - site nav;
  - section intro;
  - content pane;
  - project scroll;
  - social links;
  - media blocks.
- Avoid duplicate full-page HTML.
- Prepare content examples for Inhouse, Brands, Archive, About.

### Phase 3 - Migrate to Nuxt

- Create Nuxt project structure.
- Move visual CSS into Nuxt assets.
- Build layout components.
- Implement routes.
- Move menu to data.
- Move projects/archive to local data.
- Preserve desktop layout exactly before adding new behavior.

### Phase 4 - Add Interactions

- Custom reel player.
- Fullscreen video mode.
- Mobile fullscreen menu.
- Route/page transitions.
- Archive open/close behavior.
- Project open/close behavior.

### Phase 5 - Content System

- Decide local data vs Nuxt Content vs Sanity.
- Only add CMS after the content model is stable.
- Keep project data structured and portable.

## Session Checklist

At the start of a new session:
1. Read `PROJECT_ROADMAP.md`.
2. Read `PROJECT_NOTES.md`.
3. Check `git status --short`.
4. Confirm whether the goal is visual polishing, architecture, Nuxt migration, or content.
5. Do not overwrite user edits.

Before changing layout:
1. Preserve 24-column desktop logic unless explicitly changing architecture.
2. Check desktop first.
3. Then check tablet/mobile implications.

Before creating a new page:
1. Ask whether it should be a future Nuxt route.
2. Avoid copying the entire page shell.
3. Reuse nav, intro, content pane, scroll, and media patterns.

Before adding CMS:
1. Confirm project/archive fields.
2. Confirm image/video workflow.
3. Confirm whether editing without code is actually needed now.

## Open Decisions

- Exact mobile menu design.
- Tablet breakpoint and compact logo behavior.
- Final reel video hosting/source strategy.
- Whether video quality selector uses local files, CDN, Mux, Vimeo API, or another service.
- Whether archive open item behaves like a route page, overlay-like content pane, or animated expansion.
- Whether to use Nuxt Content or Sanity after Nuxt migration.
- Whether the site needs a global footer. Current direction: no global footer yet; use reusable social links instead.
