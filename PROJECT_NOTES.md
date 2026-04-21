# Project Notes

## Context

Static portfolio project page in `C:\Projects\my-new-app`.

Main files:
- `index.html`
- `styles.css`
- `assets/`

The page opens directly in the browser. No dev server is required.

## Layout Principles

- Desktop layout uses a 24-column grid.
- Page margin: `16px`.
- Grid gutter: `16px`.
- Font: Inter.
- Base text: `16px`.
- Global line-height: `20px`.

Column structure:
- Columns `1-4`: logo and menu.
- Columns `5-8`: project description block.
- Columns `9-24`: project content frame.

The right content frame has:
- top project header with title `Stickerburg`;
- close button `[x]`;
- scrollable content area below.

## Scrollbar Behavior

The project content scrolls inside the right frame on desktop.

Scrollbar requirements:
- located inside the right `16px` edge area;
- `4px` transparent space, `8px` black scrollbar, `4px` transparent space;
- no rounded corners;
- no top/bottom arrows;
- no extra white gap between image/content and scrollbar.

Current implementation uses:
- `--scrollbar-gutter: 16px`;
- custom WebKit scrollbar styles;
- hidden `::-webkit-scrollbar-button`.

## Interaction Details

Menu:
- four menu links are normal, not italic;
- hover underline animates left to right;
- underline sits close to the text;
- menu block is shifted down `4px`;
- logo opacity becomes `0.7` on hover.

Close button:
- text is `[x]`;
- aligned to the right edge of the photo/content, not the scrollbar;
- hover state has black background and white text;
- button background should be compact around the text, not a wide rectangle.

Footer links:
- `Download project images [↓]`, `Mail`, `Telegram`, `LinkedIn` use the same left-to-right underline hover animation;
- `Mail`, `Telegram`, `LinkedIn` clickable width is only the word width;
- footer contact underline is visually `2px` to match the menu underline appearance.

## Assets

Current real assets:
- `assets/logo.svg`
- `assets/cap.jpg`
- `assets/laptop.jpg`
- `assets/box.jpg`
- `assets/appart.jpg`
- `assets/ring.jpg`

## Current Design Direction

Minimal, precise, grid-based, editorial portfolio page. Avoid decorative effects, cards, gradients, rounded UI, or extra explanatory text. Follow the reference screenshot closely and prefer small pixel-level adjustments.
