// ── Spray-can graffiti. Desktop: hold Ctrl (or Cmd on Mac)—cursor swaps
// to a black spray-can icon. Hold it + drag with the left mouse button:
// paints a spray-style stroke—add Shift for red (#EB1026) or Alt for
// green (#11E3B0), held for the whole stroke; plain Ctrl+drag stays the
// default black/gray. Release Ctrl/Cmd: painting stops, but the tag
// itself stays put—nothing fades or clears on its own. To wipe it,
// press Backspace, Delete, Space, or Escape (while not typing in a text
// field), or just reload/leave the page.
//
// Touch (phone/tablet): hold a finger still for 3s to arm a stroke (the
// same spray-can cursor appears at that point)—drag while held, lift to
// end it. Two fingers tapped together quickly (no long-press) erases
// everything, same as Escape. Touch strokes are content-relative to the
// PAGE's own scroll (mobile has no desktop-style custom-scrolled pane—
// the whole page scrolls natively, see mobile.css/ScrollPane.vue's
// Lenis being desktop-gated), so a tag stays on whatever it was drawn
// over as the page scrolls, same principle as the desktop pane canvas
// just keyed to window.scrollY instead of a specific element's
// scrollTop.
//
// Shared across every Brands page (originally a nimax-only prototype;
// see graffiti.css for the matching styles and logo-scrub.js for the
// separate logo hover-scrub feature it ships alongside). Targets
// whichever page's own `.content-pane`/`.content-pane__scroll` it finds
// itself on—works the same whether that's a project page's photo
// gallery or the Brands listing's card grid, since neither the pane nor
// the card boundaries this reads are project-specific.
//
// Rendering: no WebGL—this is plain Canvas 2D. Paint that lands
// outside .content-pane (the sidebar/page background) goes on a
// fixed full-viewport canvas, since that area never scrolls.
// Paint that lands ON the pane's scroll body is stored in
// content-relative coordinates on an off-screen canvas (never inserted
// into the page) sized to the gallery's full scrollable height; a small
// on-screen canvas, sized to just the visible scroll window and fixed
// in place over it, shows only the currently-visible slice, re-copied
// on every paint and every scroll (see blitPane). Measured directly:
// the exact same drawing work costs roughly 7x more per frame on
// an on-screen canvas the gallery's full height than on a
// viewport-sized one, purely from the browser having to
// recomposite that much backing store—independent of how little
// of it actually changed. Keeping the tall canvas off-screen
// and only ever showing a viewport-sized crop is what makes
// painting on the pane cost the same as painting on the sidebar.
// Drips that fall on the pane store their content-relative (x, y)
// from the moment they're triggered rather than re-deriving it
// from screen coordinates each frame: doing the latter through
// whatever the current scroll happens to be produced a visible
// "jump" the next time Ctrl was held after scrolling in between.
// The pane's own left/top/right edges (and its header bar, which
// sits above this whole layer and must never get painted over)
// are enforced the same way regardless of which canvas a given
// dot ends up on—see stampDot and updateDrips.
//
// Each "stamp" is a scatter of small dots (two populations: a
// wide sparse outer scatter for the textured edge, plus a tight
// near-opaque core for the bulk of the line)—overlapping dots
// from slow/repeated passes naturally darken via ordinary alpha
// compositing. The scatter is biased toward a fixed cap-tilt
// angle to fake a fat cap held at a consistent lean, widens on
// sharp turns or when the cursor slows down (dwelling pools more
// paint), and its overall radius wobbles a few percent along the
// stroke (a slow random walk, not per-dot noise) so the line
// doesn't read as a perfectly uniform tube.
//
// Self-crossing ("paint over paint gets thicker"): a coarse grid
// tracks how many times a stamp has landed near each cell,
// without ever reading pixels back off the canvas. A cell
// revisited a few times stamps denser; a cell that's really
// piled up triggers a one-shot drip that crawls slowly down the
// page over many frames, wobbling as it falls and widening into
// a rounded, pear-like tip—independent of whatever else is being
// drawn elsewhere in the meantime.
//
// Content-pane surface: paint on it is slightly less opaque, and
// near its left edge paint itself lifts up a few px there (a
// smoothed zone, not a hard cut). Baked directly into each dot's
// own fill color as it's drawn, paint within a band right of the
// edge also lightens from gray toward black the further right it
// lands—reading as the paint itself catching a sheen off the
// surface, not a separate overlay.
//
// The cursor only ever tilts (7deg, while the button's down—
// never a full rotation) and otherwise stays upright, cap fixed
// left, matching the reference icon. Its own position-tracking
// uses an adaptive smoothing factor: tiny movements (hand tremor)
// barely nudge it, real strokes get a snappier factor—filters
// micro-jitter without reintroducing a laggy feel.
//
// Every tunable number lives in CFG below—no live settings panel
// anymore (it was only ever a tuning aid; the values are dialed in and
// baked in as the defaults now).
//
// Swap in a real exported brush stamp later by replacing the
// `stampDot` scatter loop with drawImage() calls onto a loaded
// PNG—the path/smoothing/opacity/edge logic underneath doesn't
// need to change.
//
// SPA note: on the static site this ran once per full page load and
// never needed to tear itself down. The Nuxt port re-runs it on every
// client-side navigation (a different page's .content-pane is a
// different DOM node each time), so the whole thing is wrapped as
// window.initGraffiti()—call it, get back a destroy() that removes
// every DOM node and listener this created—instead of a bare IIFE that
// just runs once and leaks on the next navigation. See
// plugins/graffiti.client.ts for the actual init/destroy-on-navigate
// wiring.
window.initGraffiti = function initGraffiti() {
  // (pointer: fine) alongside the width check--Ctrl+drag needs a real
  // keyboard+mouse, so a wide-viewport touch device (tablet landscape,
  // "desktop site" on a phone) should never arm this either.
  var desktopQuery = window.matchMedia('(min-width: 981px) and (pointer: fine)');
  // Touch tagging (long-press to arm, see the bottom of this file) is a
  // separate, additive input path--gated on touch capability, not on
  // desktopQuery, so it works on phones/tablets even where the Ctrl+drag
  // path above is inert. A hybrid device (touchscreen laptop) can
  // legitimately have both true at once; that's fine, they don't
  // conflict (one needs a held Ctrl key, the other a 3s hold with no
  // modifier).
  var touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!desktopQuery.matches && !touchCapable) return function () {};

  // Values below are andrey's own tuned pass from the settings
  // panel (2026-09-12)—dialed in by eye, not derived from
  // anything, so don't "fix" any that look unusual (e.g.
  // surfaceAlpha/dotAlphaOuterRange above 1 just clamp to fully
  // opaque; that's fine, it's how they were tuned).
  var CFG = {
    lerpSlow: 0.15,
    lerpFast: 0.6,
    lerpSpeedRef: 8,
    capTilt: 0.8,

    outerCountBase: 70,
    outerCountSpread: 10,
    outerCountMult: 5,
    outerRadiusBase: 10,
    outerRadiusSpread: 30,
    outerRadiusMult: 3,
    coreCountBase: 40,
    coreCountSpread: 10,
    coreRadiusFrac: 1,
    dotAlphaOuterMin: 0.65,
    dotAlphaOuterRange: 1,
    dotAlphaCoreMin: 0.85,
    dotAlphaCoreRange: 0.15,
    widthWobbleRange: 10,

    cellSize: 90,
    crossAt: 9,
    crossBoost: 2,
    dripAt: 2,
    dripFallMin: 0.3,
    dripFallRange: 0.15,
    dripWobbleAccel: 0.1,
    dripWobbleDamp: 0.9,
    dripMaxDistMin: 90,
    dripMaxDistRange: 200,

    surfaceAlpha: 3,
    edgeLiftMax: 7,
    edgeZone: 10,
    sheenWidth: 200,
    sheenLightness: 30
  };

  // Fixed, viewport-sized: paint that lands outside .content-pane
  // (the sidebar/page background), which never scrolls.
  var canvas = document.createElement('canvas');
  canvas.id = 'graffiti-canvas';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  // The paintable "surface" is the scroll body only—NOT the
  // header bar above it (project title + close button, on project
  // pages), which sits on top as its own opaque strip and should
  // never get painted over. paneRect drives every on-surface effect
  // below; cardRect (the whole section, header included) keeps the
  // fixed layer's paint off the header (see stampDot/updateDrips).
  // Resolved here, before resize() and the canvases it sizes, so
  // the very first resize() call has a fresh rect to work from
  // rather than a not-yet-assigned one.
  var pane = document.querySelector('.content-pane__scroll');
  // The pane's single direct child is whatever this particular page
  // scrolls—a project page's photo gallery (`.project-content`) or
  // the Brands listing's card grid (`.inhouse-grid`). Either way it's
  // the thing whose own top/left/width/height anchor every
  // content-relative coordinate below, so there's no need to name its
  // class specifically.
  var article = pane ? pane.firstElementChild : null;
  var paneRect = null;
  // The custom scrollbar track (see scroll.js/styles.css) sits in
  // this many px reserved along the pane's own right edge—paint
  // should stop before it, not visually run underneath/through
  // it. Measured off the track element itself (scroll.js creates
  // it synchronously, earlier in the page, so it already exists
  // here) rather than parsing --scrollbar-gutter directly: that
  // var is a calc() expression, and getComputedStyle returns
  // custom properties as their literal authored text, not the
  // resolved px value—parseFloat on "calc(...)" is just NaN.
  var scrollbarGutter = (function () {
    var track = document.querySelector('.custom-scrollbar');
    var measured = track ? parseFloat(getComputedStyle(track).width) : NaN;
    return isNaN(measured) ? 16 : measured;
  })();
  // Undefined until the first updatePaneRect() call below. A
  // couple of px more conservative than the gutter's own measured
  // width, on purpose: paneRect's own edges come back as
  // fractional CSS px (e.g. 906.671875), and a dot landing right
  // at that boundary can round to a device pixel or two past it
  // once scaled by dpr—visible as a sliver of paint creeping into
  // the scrollbar's own space instead of stopping cleanly short.
  var paneRightEdge = null;
  function updatePaneRect() {
    paneRect = pane ? pane.getBoundingClientRect() : null;
    paneRightEdge = paneRect ? paneRect.right - scrollbarGutter - 2 : null;
  }
  // How far below the section's own bottom edge a stamp's outer
  // scatter can realistically still land (the widest outer radius
  // the tuned CFG below produces)—used only to widen where the
  // fixed canvas refuses to paint near the section's bottom-right
  // corner (see stampDot), not to change anything about the pane
  // itself.
  var CARD_BOTTOM_MARGIN = 150;

  var card = document.querySelector('.content-pane');
  var cardRect = null;
  // cardRect exists purely to protect a PANE-canvas page's own scroll
  // container—its header bar, and the strip the pane-side canvas
  // already owns—from ALSO getting painted by the fixed canvas. A page
  // with no scrollable pane (the home page, 404) has no such
  // competing system to protect: it's just an ordinary block of the
  // page, so the fixed canvas should paint over it like anything else
  // instead of leaving a dead unpaintable rectangle in the middle of
  // the screen. Gated on `pane` existing, not just `card`.
  function updateCardRect() { cardRect = (pane && card) ? card.getBoundingClientRect() : null; }

  // Real storage for pane paint: off-screen (never inserted into
  // the page), sized to the gallery's full scrollable height.
  // Every pane-side stamp/drip draw below still targets this in
  // content-relative coordinates, exactly as if it were on
  // screen—nothing about that logic changes. Keeping it
  // off-screen is what makes its height free: a canvas this tall
  // (thousands of px) is expensive to composite every frame ONLY
  // if it's actually on screen; measured directly, the same draw
  // work costs ~7x more per frame on an on-screen canvas this
  // size than a viewport-sized one, independent of how little of
  // it is actually painted. Read from, never shown.
  var paneCanvas = document.createElement('canvas');
  var pctx = paneCanvas.getContext('2d');

  // What's actually on screen for the pane: a small canvas, sized
  // to the visible scroll window (not the gallery), fixed in
  // place over it. blitPane() below copies just the currently
  // visible slice of the off-screen store into this—every frame
  // while painting, and on every scroll—so showing pane paint
  // costs the same as the sidebar's viewport-sized canvas,
  // regardless of how tall the gallery is.
  var paneView = document.createElement('canvas');
  paneView.id = 'graffiti-pane-view';
  document.body.appendChild(paneView);
  var pvctx = paneView.getContext('2d');

  // Archive lightbox filmstrip (see app/components/ArchivePreview.vue):
  // a third paint surface, same off-screen-store/on-screen-view split as
  // the pane above, but keyed to the filmstrip's own horizontal
  // scrollLeft instead of the page's vertical scroll. The filmstrip's
  // DOM node doesn't exist at init (it only mounts while a series card
  // is open) and gets torn down/recreated on every open--so unlike
  // pane/card/article above, it's polled for in scrollWatchTick rather
  // than looked up once here.
  var filmstripEl = null;
  var filmstripRect = null;
  var lastFilmstripScrollLeft = 0;
  var filmstripCanvas = document.createElement('canvas');
  var fctx = filmstripCanvas.getContext('2d');
  var filmstripView = document.createElement('canvas');
  filmstripView.id = 'graffiti-filmstrip-view';
  document.body.appendChild(filmstripView);
  var fvctx = filmstripView.getContext('2d');

  function updateFilmstripRect() {
    filmstripRect = filmstripEl ? filmstripEl.getBoundingClientRect() : null;
  }

  // (Re)sizes the off-screen store to the filmstrip's full scrollable
  // width and the on-screen view to its visible rect--called whenever
  // the filmstrip (re)mounts or the window resizes. Always starts blank:
  // a freshly opened filmstrip has nothing on it yet (ArchivePreview.vue
  // wipes all graffiti on every card switch/close), and a resize losing
  // whatever was mid-stroke is an acceptable, rare edge case, same as
  // the pane canvas above.
  function setupFilmstripCanvas() {
    updateFilmstripRect();
    if (!filmstripEl || !filmstripRect) return;
    var w = Math.max(1, filmstripEl.scrollWidth);
    var h = Math.max(1, Math.round(filmstripRect.height));
    filmstripCanvas.width = Math.round(w * dpr);
    filmstripCanvas.height = Math.round(h * dpr);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    filmstripView.width = Math.round(filmstripRect.width * dpr);
    filmstripView.height = Math.round(filmstripRect.height * dpr);
    filmstripView.style.width = filmstripRect.width + 'px';
    filmstripView.style.height = filmstripRect.height + 'px';
    filmstripView.style.left = filmstripRect.left + 'px';
    filmstripView.style.top = filmstripRect.top + 'px';
    fvctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastFilmstripScrollLeft = filmstripEl.scrollLeft;
    blitFilmstrip();
  }

  // Same idea as blitPane, just horizontal: copies the currently-visible
  // vertical... horizontal slice of the off-screen store into the small
  // on-screen view canvas. Raw device pixels both sides, so the identity
  // transform (see blitPane's own comment for why).
  function blitFilmstrip() {
    if (!filmstripEl || !filmstripRect) return;
    var sx = Math.round(filmstripEl.scrollLeft * dpr);
    var sw = filmstripView.width, sh = filmstripView.height;
    if (sw <= 0 || sh <= 0) return;
    fvctx.save();
    fvctx.setTransform(1, 0, 0, 1, 0, 0);
    fvctx.clearRect(0, 0, sw, sh);
    fvctx.drawImage(filmstripCanvas, sx, 0, sw, sh, 0, 0, sw, sh);
    fvctx.restore();
  }

  // Mobile touch strokes: same off-screen-store/on-screen-view split as
  // the desktop pane above, but keyed to window.scrollY (the whole page
  // scrolls natively on mobile--no .content-pane__scroll to speak of)
  // instead of a specific element's scrollTop, and covering the FULL
  // page width/height rather than a narrower content column (mobile has
  // no sidebar to carve out). Only ever used for touch-armed strokes
  // (see stampDot)--desktop mouse strokes never touch this.
  var mobilePaneCanvas = document.createElement('canvas');
  var mpctx = mobilePaneCanvas.getContext('2d');
  var mobilePaneView = document.createElement('canvas');
  mobilePaneView.id = 'graffiti-mobile-pane-view';
  document.body.appendChild(mobilePaneView);
  var mpvctx = mobilePaneView.getContext('2d');
  var lastPageScrollY = 0;

  // (Re)sizes the off-screen store to the page's own full scrollable
  // height--called on resize and whenever that height changes (a
  // ResizeObserver on <body>, since mobile pages load/reflow images
  // asynchronously same as the desktop pane's gallery does). Always
  // starts blank on a real resize (rare mid-stroke edge case, same
  // acceptable tradeoff as the desktop pane/filmstrip canvases).
  function setupMobilePaneCanvas() {
    if (!touchCapable) return;
    var w = window.innerWidth;
    var h = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    mobilePaneCanvas.width = Math.round(w * dpr);
    mobilePaneCanvas.height = Math.round(h * dpr);
    mpctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mobilePaneView.width = Math.round(w * dpr);
    mobilePaneView.height = Math.round(window.innerHeight * dpr);
    mobilePaneView.style.width = w + 'px';
    mobilePaneView.style.height = window.innerHeight + 'px';
    mobilePaneView.style.left = '0px';
    mobilePaneView.style.top = '0px';
    mpvctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastPageScrollY = window.scrollY;
    blitMobilePane();
  }

  // Same idea as blitPane, just against window.scrollY instead of an
  // element's scrollTop.
  function blitMobilePane() {
    var sy = Math.round(window.scrollY * dpr);
    var sw = mobilePaneView.width, sh = mobilePaneView.height;
    if (sw <= 0 || sh <= 0) return;
    mpvctx.save();
    mpvctx.setTransform(1, 0, 0, 1, 0, 0);
    mpvctx.clearRect(0, 0, sw, sh);
    mpvctx.drawImage(mobilePaneCanvas, 0, sy, sw, sh, 0, 0, sw, sh);
    mpvctx.restore();
  }

  var articleRect = null;
  function updateArticleRect() { articleRect = article ? article.getBoundingClientRect() : null; }

  var cursor = document.createElement('div');
  cursor.className = 'graffiti-cursor';
  // Supplied can icon: fixed upright, cap/nozzle permanently facing
  // left (the flare path pointing toward x=0)—it never rotates to
  // face the direction of travel, unlike a real spray-paint jitter
  // cursor might; this one just tracks position.
  cursor.innerHTML =
    '<div class="graffiti-cursor__tilt">' +
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="32" y="22" width="36" height="76" fill="#171717"/>' +
        '<rect x="44" y="2" width="12" height="15" fill="#171717"/>' +
        '<path d="M44 4L0 0V22L44 8L44 4Z" fill="#171717"/>' +
        '<path d="M35 21C35 16.0294 39.0294 12 44 12H56C60.9706 12 65 16.0294 65 21V24H35V21Z" fill="#171717"/>' +
      '</svg>' +
    '</div>';
  document.body.appendChild(cursor);
  var cursorTilt = cursor.querySelector('.graffiti-cursor__tilt');
  // Nozzle/flare tip, in the icon's rendered (46x46, see CSS) size—
  // the point that should sit exactly under the real cursor
  // position. The source viewBox is 100x100 with the flare tip at
  // roughly (1, 10); scaled by the 0.46 display ratio.
  var HOTSPOT_X = 0.5, HOTSPOT_Y = 4.6;

  // Capped rather than the raw devicePixelRatio: these canvases
  // get repainted with dozens–hundreds of arc()+fill() calls per
  // frame while drawing, and that cost scales with backing-store
  // pixel count. 2x/3x retina buffers roughly double/quadruple it
  // for a softness difference that's hard to see in a loose,
  // textured spray effect anyway.
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  // The min-width:981px check at the top of this script only ever
  // runs once, at load—if the page loaded wide enough for the
  // feature to initialize and the window is later narrowed below
  // that (not just an actual mobile visit, but dragging a desktop
  // browser window down, or rotating a tablet), everything below
  // stayed fully live and kept sizing/blitting itself against a
  // pane rect that no longer matches the phone/tablet layout the
  // CSS has switched to underneath it—among other things, that's
  // what was breaking scrolling there. Checked live on every
  // resize instead: below the breakpoint, every overlay hides and
  // Ctrl-mode is force-released; above it, everything comes back.
  function resize() {
    if (!desktopQuery.matches && !touchCapable) {
      canvas.style.display = 'none';
      paneView.style.display = 'none';
      filmstripView.style.display = 'none';
      mobilePaneView.style.display = 'none';
      setCtrlMode(false);
      return;
    }
    canvas.style.display = '';
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!desktopQuery.matches) {
      // Touch-only (no fine pointer/desktop width): no desktop pane/
      // card/filmstrip concept in play here (mobile.css lets
      // .content-pane flow with the natively-scrolling body instead of
      // the desktop's Lenis-driven .content-pane__scroll)--paneRect/
      // cardRect simply stay null (never assigned below), which is
      // exactly what already makes stampDot's routing fall through past
      // those branches on its own. Touch strokes instead get their own
      // mobile pane, keyed to the page's own scroll (see
      // setupMobilePaneCanvas/stampDot).
      paneView.style.display = 'none';
      filmstripView.style.display = 'none';
      mobilePaneView.style.display = touchCapable ? '' : 'none';
      if (touchCapable) setupMobilePaneCanvas();
      resetDripState();
      return;
    }
    paneView.style.display = '';
    filmstripView.style.display = '';
    mobilePaneView.style.display = 'none';

    updatePaneRect();
    updateCardRect();

    if (article) {
      var w = article.offsetWidth, h = article.offsetHeight;
      paneCanvas.width = Math.round(w * dpr);
      paneCanvas.height = Math.round(h * dpr);
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Same dpr transform as the off-screen store—stampDot and
    // friends draw straight onto this too (see stampDot), in the
    // same CSS-space coordinates it uses for pctx, and without
    // this it'd land at 1/dpr scale, squashed toward the top-left
    // corner. blitPane()'s drawImage() needs the opposite (raw
    // device pixels, no transform) since it's copying the whole
    // buffer 1:1—it switches to identity and back around that one
    // call instead.
    if (paneRect) {
      paneView.width = Math.round(paneRect.width * dpr);
      paneView.height = Math.round(paneRect.height * dpr);
      paneView.style.width = paneRect.width + 'px';
      paneView.style.height = paneRect.height + 'px';
      paneView.style.left = paneRect.left + 'px';
      paneView.style.top = paneRect.top + 'px';
      pvctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    updateArticleRect();
    if (filmstripEl) setupFilmstripCanvas();
    // Reassigning a canvas's width/height always wipes its pixels,
    // even to the same value—true here on every real window
    // resize, and also whenever browser zoom changes (Chrome fires
    // `resize` and reports a different devicePixelRatio, so this
    // whole function reruns). The drip/density bookkeeping below
    // lives independently of those pixels, though, and a drip
    // that's still mid-fall would otherwise keep animating onto
    // the now-blank canvas—paint reappearing with no stroke behind
    // it, out of nowhere. Wipe the logical state to match.
    resetDripState();
    blitPane();
  }
  window.addEventListener('resize', resize);
  resize();
  // The article's own height changes as lazy images load in—keep
  // the pane canvas's drawing buffer matched to it, or paint near
  // the bottom of a long gallery would just get cropped off.
  var resizeObserver = null;
  if (article && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(article);
  }
  // Same idea for the mobile pane's own off-screen store: the page's
  // total scroll height changes as lazy images load in, same reasoning
  // as the desktop pane's own observer above.
  var mobileResizeObserver = null;
  if (touchCapable && 'ResizeObserver' in window) {
    mobileResizeObserver = new ResizeObserver(resize);
    mobileResizeObserver.observe(document.body);
  }

  // Copies just the visible slice of the off-screen pane store
  // into the small on-screen view canvas—the step that actually
  // makes the gallery's full-height paint storage above free to
  // display. Source rect and destination canvas are both worked
  // out in raw device pixels (paneCanvas/paneView's own
  // .width/.height), so this needs the identity transform—the
  // persistent dpr one on pvctx is for stampDot's direct draws
  // (see resize) and would double-scale this 1:1 copy.
  function blitPane() {
    if (!paneRect || !articleRect) return;
    var sy = Math.round((paneRect.top - articleRect.top) * dpr);
    var sw = paneView.width, sh = paneView.height;
    if (sw <= 0 || sh <= 0) return;
    pvctx.save();
    pvctx.setTransform(1, 0, 0, 1, 0, 0);
    pvctx.clearRect(0, 0, sw, sh);
    pvctx.drawImage(paneCanvas, 0, sy, sw, sh, 0, 0, sw, sh);
    pvctx.restore();
  }
  // Scrolling changes which slice is "visible" regardless of
  // whether Ctrl is held or anything is being drawn right now, so
  // this runs unconditionally (tick() below only runs while
  // ctrlHeld)—and deliberately as a scrollTop poll on its own
  // requestAnimationFrame loop, not a 'scroll' event listener.
  // Lenis (see scroll.js) drives scrollTop from its own rAF loop,
  // and browsers are free to dispatch the 'scroll' event on a
  // LATER frame than the one the compositor actually moved the
  // content in—so even a perfectly synchronous scroll handler can
  // end up a frame behind, reading as a parallax drift while
  // scrolling. Polling scrollTop directly every frame instead
  // sidesteps that: since scroll.js registers Lenis's own rAF
  // callback earlier in the page than this one, this callback
  // runs after Lenis has already moved scrollTop for the frame,
  // so it always reads the current value, not last frame's.
  var lastScrollTop = pane ? pane.scrollTop : 0;
  var scrollWatchRafId = null;
  function scrollWatchTick() {
    scrollWatchRafId = requestAnimationFrame(scrollWatchTick);
    if (!desktopQuery.matches) {
      if (touchCapable && window.scrollY !== lastPageScrollY) {
        lastPageScrollY = window.scrollY;
        blitMobilePane();
      }
      return;
    }
    if (pane && pane.scrollTop !== lastScrollTop) {
      lastScrollTop = pane.scrollTop;
      updateArticleRect();
      blitPane();
    }
    // The filmstrip mounts/unmounts with the Archive lightbox itself
    // (v-if in ArchivePreview.vue)--a plain querySelector poll here,
    // same cadence as the scrollTop poll above, since there's no mount/
    // unmount event to hook into from this plain script.
    var fs = document.querySelector('.archive-preview__filmstrip');
    if (fs !== filmstripEl) {
      filmstripEl = fs;
      if (fs) setupFilmstripCanvas();
    } else if (fs && fs.scrollLeft !== lastFilmstripScrollLeft) {
      lastFilmstripScrollLeft = fs.scrollLeft;
      blitFilmstrip();
    }
  }
  scrollWatchTick();

  // A ridge right at the pane's left edge: paint nudges up there,
  // smoothed over a zone so it reads as a seam, not a glitch.
  // Only ever called for points already confirmed inside the
  // pane's vertical range, so no top/bottom check needed here.
  function edgeLift(x) {
    if (!paneRect) return 0;
    var d = x - paneRect.left;
    if (Math.abs(d) > CFG.edgeZone) return 0;
    return -CFG.edgeLiftMax * (1 - Math.abs(d) / CFG.edgeZone);
  }

  // Lightens paint within a band right of the pane's left edge,
  // fading to pure black by sheenWidth—baked into each dot's own
  // fill color at draw time (not a separate overlay pass), so it
  // can only ever show up on paint that's actually been stamped
  // there, and never accumulates pass after pass.
  function surfaceTone(x) {
    if (!paneRect) return 0;
    var d = x - paneRect.left;
    if (d < 0 || d > CFG.sheenWidth) return 0;
    return Math.round((1 - d / CFG.sheenWidth) * CFG.sheenLightness);
  }

  var ctrlHeld = false;
  var isDrawing = false;
  var raw = { x: -999, y: -999 };
  var smooth = { x: -999, y: -999 };
  var lastStamp = null;
  var lastAngle = 0;
  var rafId = null;
  var widthWobble = 1;
  // Adaptive quality: on a CPU too slow to keep up with the full
  // dot counts below, each stamp would otherwise take even longer
  // to render than the last, snowballing into a stall. Tracking
  // actual frame time and scaling dot counts down when frames run
  // long (recovering slowly when they don't) keeps drawing
  // responsive on weak hardware without touching how dense a fast
  // machine renders it. Reset to 1 each time Ctrl is pressed (see
  // setCtrlMode)—time elapsed while not drawing shouldn't count
  // against it.
  var qualityScale = 1;
  var lastFrameTime = 0;

  // Self-crossing detection: rather than reading pixels back off
  // the canvas (slow, and the exact reason browsers warn about
  // getImageData in a hot loop), a coarse grid of "how many times
  // has a stamp landed near here" counters approximates the same
  // thing—cheap array lookups instead of pixel readback. Crossing
  // a cell that's already seen a few passes stamps denser there
  // ("paint over paint"); a cell that's built up a real pile
  // eventually kicks off a drip. Persists across separate Ctrl
  // sessions—only the manual clear-all resets it—since the tag
  // itself now persists the same way.
  var density = {};
  var dripped = {};
  var drips = [];
  // A long, heavily-crossed session could otherwise trigger drips
  // faster than they finish falling, growing the per-frame update
  // cost without bound. Once this many are live, new trigger
  // points still register as "dripped" (no retry pile-up) but
  // just don't spawn another—existing ones keep falling normally.
  var MAX_DRIPS = 60;
  // Shared by the explicit clear-all below and by resize() (a
  // browser-zoom or window-resize event wipes the canvas pixels
  // either way—see resize()—so this keeps the bookkeeping in sync
  // with that rather than leaving orphaned drips animating onto a
  // blank canvas).
  function resetDripState() {
    density = {};
    dripped = {};
    drips = [];
    widthWobble = 1;
  }
  function cellKey(x, y) { return (x / CFG.cellSize | 0) + '_' + (y / CFG.cellSize | 0); }
  function registerDensity(x, y) {
    var key = cellKey(x, y);
    var d = (density[key] || 0) + 1;
    density[key] = d;
    if (d >= CFG.dripAt && !dripped[key] && drips.length < MAX_DRIPS) {
      dripped[key] = true;
      // Bake the drip's rendering space and any content-surface
      // treatment in once, at creation, from the (x, y) it was
      // triggered at—not re-derived every frame from wherever the
      // article happens to be on screen right now. A drip that
      // falls on the pane is otherwise stored using screen
      // coordinates that go stale the instant the user scrolls
      // while Ctrl is released (tick(), and with it
      // updateArticleRect(), pauses then): the next time Ctrl is
      // held it would suddenly resume from a reprojected position
      // that no longer matches where it actually is, reading as a
      // drip that "jumps" out of nowhere. Content-relative
      // coordinates don't have anywhere to go stale—the canvas
      // they're drawn on scrolls for free.
      // Horizontal-only membership, same as stampDot—a drip
      // triggered above the header or below the current bottom
      // fold is still logically on the pane (see stampDot for
      // why), just not necessarily visible the moment it starts.
      var inFilmstrip = !touchArmed && filmstripEl && filmstripRect && x >= filmstripRect.left && x <= filmstripRect.right && y >= filmstripRect.top && y <= filmstripRect.bottom;
      var inPane = !touchArmed && !inFilmstrip && paneRect && x >= paneRect.left && x <= paneRightEdge;
      // Captured now, not read live at render time: a drip can still
      // be falling several strokes (and color-modifier changes) later,
      // and should keep the color of the stroke that triggered it.
      var drip = { vel: 0, dist: 0, maxDist: CFG.dripMaxDistMin + Math.random() * CFG.dripMaxDistRange, color: strokeColor };
      if (touchArmed) {
        // Same reasoning as stampDot's own touchArmed branch: mobile has
        // no fixed/pane split, just content-relative-to-window.scrollY
        // storage--without this branch, every mobile drip fell through
        // to the 'fixed' case below and got stored in raw SCREEN
        // coordinates on the non-scrolling canvas, which read as the
        // drip staying put on screen while the page (and the tag it fell
        // from) scrolled out from under it.
        drip.space = 'mobile';
        drip.x = x;
        drip.y = y + window.scrollY;
        drip.tone = 0;
        drip.alphaMul = 1;
      } else if (inFilmstrip) {
        drip.space = 'filmstrip';
        drip.x = x - filmstripRect.left + filmstripEl.scrollLeft;
        drip.y = y - filmstripRect.top;
        drip.tone = 0;
        drip.alphaMul = 1;
      } else if (inPane) {
        drip.space = 'pane';
        drip.x = x - (articleRect ? articleRect.left : paneRect.left);
        drip.y = y - (articleRect ? articleRect.top : paneRect.top) + edgeLift(x);
        drip.tone = surfaceTone(x);
        drip.alphaMul = CFG.surfaceAlpha;
      } else {
        drip.space = 'fixed';
        drip.x = x;
        drip.y = y;
        drip.tone = 0;
        drip.alphaMul = 1;
      }
      drips.push(drip);
    }
  }

  // The only way any of this goes away now: reload/navigate, or
  // this explicit wipe (bound to Backspace/Delete/Space below).
  // Guarded against a second press mid-clear re-triggering the same
  // cycle on top of itself.
  //
  // Two interchangeable effects, picked per page by a global set
  // BEFORE this script loads (window.GRAFFITI_CLEAR_EFFECT = 'wipe')
  // so a page can try the new one without every other Brands page
  // picking it up too:
  //   - 'fade' (default): a quick opacity fade—a compositor-only CSS
  //     transition, no extra rendering work.
  //   - 'wipe': a board-eraser sweep, top-left to bottom-right, via an
  //     animated CSS mask—still just a transform of two DOM elements,
  //     no per-dot work, so it's exactly as cheap as the fade.
  // Either way the pixels are actually cleared only once the canvases
  // are fully hidden, then they reappear already blank.
  var CLEAR_EFFECT = window.GRAFFITI_CLEAR_EFFECT === 'wipe' ? 'wipe' : 'fade';
  var clearing = false;
  function clearAll() {
    if (clearing) return;
    clearing = true;
    // Whatever nav link/button happened to end up focused during the
    // stroke that triggered this (mousedown/mouseup landing on it while
    // the canvas's own pointer-events:none lets clicks fall through)
    // shouldn't keep showing its focus ring once the tag is gone.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    // The on-screen canvases only—paneCanvas is the off-screen store
    // now and was never visible to begin with, so animating that
    // would do nothing.
    var visible = [canvas, paneView, filmstripView, mobilePaneView];
    var finish = function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pctx.clearRect(0, 0, paneCanvas.width, paneCanvas.height);
      fctx.clearRect(0, 0, filmstripCanvas.width, filmstripCanvas.height);
      mpctx.clearRect(0, 0, mobilePaneCanvas.width, mobilePaneCanvas.height);
      resetDripState();
      blitPane();
      blitFilmstrip();
      blitMobilePane();
      clearing = false;
    };
    if (CLEAR_EFFECT === 'wipe') {
      wipeAway(visible, finish);
    } else {
      visible.forEach(function (c) { c.style.opacity = '0'; });
      setTimeout(function () {
        finish();
        visible.forEach(function (c) { c.style.opacity = '1'; });
      }, 260);
    }
  }

  // Board-eraser sweep: a soft diagonal band races from the top-left
  // corner to the bottom-right, masking away everything it's already
  // passed—reads as one broad, fast stroke wiping the tag left-to-
  // right-and-down, the way a chalkboard actually gets erased, rather
  // than a flat fade. Driven by rAF (a few hundred ms, ~20 frames) and
  // a CSS mask rather than a registered custom property, so it doesn't
  // depend on @property support—cheap either way, since it's just two
  // elements' mask-image, not per-dot canvas work.
  function wipeAway(elements, onDone) {
    var DURATION = 850; // was 360—too quick to actually read as a sweep, more like a flash
    var BAND = 4; // % width of the eraser edge—was 16 (then 26), narrowed further for a crisper, less-blurred line instead of a wide soft gradient
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / DURATION);
      var eased = 1 - Math.pow(1 - t, 2); // ease-out quad: gentler than the old cubic, which front-loaded almost the whole sweep into its first half and read as an instant cut followed by nothing
      // "to bottom right" runs 0% at the top-left corner to 100% at the
      // bottom-right—so the ALREADY-WIPED (transparent) stop has to sit
      // at the LOW end and grow toward 100% as eased increases, or the
      // sweep reads backwards (erasing bottom-right first, like it did
      // before this fix). #000 stays put here as the not-yet-wiped side.
      var pos = eased * (100 + BAND) - BAND;
      var mask = 'linear-gradient(to bottom right, transparent ' + pos + '%, #000 ' + (pos + BAND) + '%)';
      elements.forEach(function (el) {
        el.style.webkitMaskImage = mask;
        el.style.maskImage = mask;
      });
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        onDone();
        elements.forEach(function (el) {
          el.style.webkitMaskImage = '';
          el.style.maskImage = '';
        });
      }
    }
    requestAnimationFrame(frame);
  }

  function setCtrlMode(on) {
    if (ctrlHeld === on) return;
    ctrlHeld = on;
    document.body.classList.toggle('graffiti-mode', on);
    cursor.classList.toggle('is-active', on);
    if (on) {
      updatePaneRect();
      updateCardRect();
      updateArticleRect();
      // Guards against the rare case where the section shifted
      // position while Ctrl was released without a full resize
      // (e.g. something above it in the page changed height)—
      // cheap enough to just always re-sync rather than detect.
      if (paneRect) {
        paneView.style.left = paneRect.left + 'px';
        paneView.style.top = paneRect.top + 'px';
      }
      blitPane();
      qualityScale = 1;
      lastFrameTime = performance.now();
    } else {
      isDrawing = false;
      lastStamp = null;
    }
  }

  function onKeyDown(e) {
    // Control on Windows/Linux and physical Mac keyboards; Meta (Cmd) is
    // Mac's own natural modifier for this kind of gesture, so it's
    // additive here—Ctrl keeps working everywhere it already did.
    if (e.key === 'Control' || e.key === 'Meta') { if (desktopQuery.matches) setCtrlMode(true); return; }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === ' ' || e.key === 'Escape') {
      // If focus is in a text input/textarea anywhere on the page,
      // these keys need to keep doing their normal editing job.
      var tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault(); // Space otherwise scrolls the page, Backspace can navigate back
      clearAll();
    }
  }
  window.addEventListener('keydown', onKeyDown);
  function onKeyUp(e) {
    if (e.key === 'Control' || e.key === 'Meta') setCtrlMode(false);
  }
  window.addEventListener('keyup', onKeyUp);
  // Alt-tabbing away (or anything else) while Ctrl is physically
  // still down would otherwise leave the mode stuck on forever,
  // since no keyup ever fires on this page.
  function onBlur() { setCtrlMode(false); }
  window.addEventListener('blur', onBlur);

  function onMouseMove(e) {
    raw.x = e.clientX;
    raw.y = e.clientY;
  }
  window.addEventListener('mousemove', onMouseMove);

  // Color modifiers, captured once at stroke-start and held for the
  // whole stroke (same as "Ctrl held = graffiti mode" already is)—
  // Ctrl+Shift+drag = red, Ctrl+Alt+drag = green, plain Ctrl+drag =
  // today's black/gray. null means "use the tone value as a literal
  // gray" (unchanged default path); a color object means "blend the
  // tone value as a lightening amount on top of this hue instead."
  var COLOR_RED = { r: 0xEB, g: 0x10, b: 0x26, key: 'red' };
  var COLOR_GREEN = { r: 0x11, g: 0xE3, b: 0xB0, key: 'green' };
  var strokeColor = null;

  function onMouseDown(e) {
    if (!ctrlHeld || e.button !== 0) return;
    // Ctrl+click normally opens a link in a new tab—while in
    // paint mode that would fight with drawing over the nav/
    // actions, so it's deliberately suppressed for the duration.
    e.preventDefault();
    isDrawing = true;
    strokeColor = e.shiftKey ? COLOR_RED : (e.altKey ? COLOR_GREEN : null);
    smooth.x = raw.x;
    smooth.y = raw.y;
    lastStamp = { x: raw.x, y: raw.y };
  }
  window.addEventListener('mousedown', onMouseDown);
  function onMouseUp() { isDrawing = false; lastStamp = null; }
  window.addEventListener('mouseup', onMouseUp);
  // Belt-and-suspenders: a link's own click handler still runs
  // unless this is stopped too (preventDefault on mousedown alone
  // doesn't cancel the subsequent click on every browser).
  function onClick(e) { if (ctrlHeld) e.preventDefault(); }
  window.addEventListener('click', onClick, true);

  // ── Touch tagging: long-press to arm, draw while held, lift to end ──
  // "После долгого зажатия пальцем... появляется курсор-балончик и ты
  // начинаешь тегать? как только убираешь палец - линия заканчивается."
  // Reuses the exact same smoothing/stamping pipeline as the mouse path
  // (isDrawing/lastStamp/smooth/raw, tick()'s stamp loop)--arming just
  // seeds those the same way onMouseDown does, so nothing downstream
  // needs to know or care whether the stroke came from a mouse or a
  // finger. Erasing is a two-finger tap (quick, both fingers together,
  // never triggered a long-press draw)--no OS permission prompt, no
  // conflict with an ordinary one-finger scroll/tap, unlike e.g.
  // shake-to-undo (needs a DeviceMotion permission dialog on iOS).
  var LONG_PRESS_MS = 3000;
  var MOVE_CANCEL_PX = 10;
  var TWO_FINGER_TAP_MS = 400;
  var touchArmed = false;
  var longPressTimer = null;
  var touchStartX = 0, touchStartY = 0;
  var twoFingerStart = null; // { time } while exactly 2 fingers are down

  function armTouchDrawing(x, y) {
    touchArmed = true;
    isDrawing = true;
    strokeColor = null;
    raw.x = smooth.x = x;
    raw.y = smooth.y = y;
    lastStamp = { x: x, y: y };
    cursor.classList.add('is-active');
    cursor.style.transform = 'translate(' + (x - HOTSPOT_X) + 'px,' + (y - HOTSPOT_Y) + 'px)';
    // Same class the desktop Ctrl-hold path toggles--ProjectCard.vue's
    // hover-preview/darken-scale logic already checks this to suppress
    // itself while a stroke is live, and that applies just as much to a
    // touch-drag preview interaction.
    document.body.classList.add('graffiti-mode');
    if (navigator.vibrate) navigator.vibrate(20); // no-op where unsupported (iOS Safari)
  }
  function disarmTouchDrawing() {
    touchArmed = false;
    isDrawing = false;
    lastStamp = null;
    cursor.classList.remove('is-active');
    document.body.classList.remove('graffiti-mode');
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      clearTimeout(longPressTimer);
      twoFingerStart = { time: performance.now() };
      return;
    }
    twoFingerStart = null;
    if (e.touches.length !== 1 || touchArmed) return;
    var t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(function () { armTouchDrawing(touchStartX, touchStartY); }, LONG_PRESS_MS);
  }
  function onTouchMove(e) {
    var t = e.touches[0];
    if (!t) return;
    if (touchArmed) {
      e.preventDefault(); // stop the page scrolling once a stroke is actually live
      raw.x = t.clientX;
      raw.y = t.clientY;
      return;
    }
    // Still waiting out the long-press: real movement means this is a
    // scroll/swipe, not a hold--cancel arming rather than fight it.
    if (Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) > MOVE_CANCEL_PX) {
      clearTimeout(longPressTimer);
    }
  }
  function onTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (touchArmed) { disarmTouchDrawing(); return; }
    if (twoFingerStart && e.touches.length === 0 && performance.now() - twoFingerStart.time < TWO_FINGER_TAP_MS) {
      clearAll();
    }
    twoFingerStart = null;
  }
  function onTouchCancel() {
    clearTimeout(longPressTimer);
    twoFingerStart = null;
    disarmTouchDrawing();
  }
  if (touchCapable) {
    // touchmove is deliberately NOT passive--onTouchMove needs to call
    // preventDefault() once a stroke is armed, to stop the page
    // scrolling out from under a live drawing gesture.
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
  }

  // Routes each dot to whichever layer actually represents where
  // it landed: inside .content-pane, it goes on the pane's own
  // (scrolling) canvas in content-relative coordinates, with the
  // surface tone/lift/edge-touch treatment; otherwise it's plain
  // paint on the fixed page canvas. A dot can only ever belong to
  // one or the other—no boundary math to get subtly wrong for
  // dots that happen to scatter right at a corner, since the
  // pane canvas's own overflow clipping backstops the rest.
  //
  // Shared low-level primitive—one dot, one context, already-
  // resolved color/alpha/position. Used by stampDot below and by
  // updateDrips (which resolves its own target/color once, at
  // creation, rather than through stampDot's routing). A single
  // stamp can scatter hundreds of these, and the actual bottleneck
  // at that volume is per-fill() overhead (state setup + rasterizer
  // dispatch), not the math—so this doesn't draw immediately.
  // Instead it queues into a bucket keyed by (context, color,
  // quantized alpha) and a real draw only happens when something
  // flushes that bucket (see flushBatch), where every dot sharing
  // a bucket becomes one beginPath()+fill() instead of its own.
  // Alpha is quantized to 16 steps—coarser than the continuous
  // random value each dot would otherwise get, but at this dot
  // size and density the scatter noise already dominates; the
  // banding isn't visible.
  // Keyed by target context itself (not a fixed pair of names)
  // since a pane-side dot now queues into up to two contexts at
  // once—the off-screen store and, when it lands in the currently
  // visible window, the small on-screen view canvas directly (see
  // stampDot/updateDrips)—and the fixed canvas is a third.
  var batches = new Map();
  // `tone` is a lightening amount (0 = the stroke's own darkest/purest
  // value, up to ~30 near the pane's left-edge sheen)—historically
  // rendered literally as a gray value (rgba(tone,tone,tone,a)). A
  // colored stroke keeps that same shading character instead of
  // rendering flat: each channel blends from the hue toward white by
  // the same tone/255 fraction the grayscale path always used.
  function paintDot(targetCtx, x, y, tone, a) {
    var qa = Math.round(a * 16) / 16;
    if (qa <= 0) return;
    var sub = batches.get(targetCtx);
    if (!sub) { sub = new Map(); batches.set(targetCtx, sub); }
    var colorKey = strokeColor ? strokeColor.key : 'k';
    var key = tone + '_' + qa + '_' + colorKey;
    var bucket = sub.get(key);
    if (!bucket) {
      var r = tone, g = tone, b = tone;
      if (strokeColor) {
        var mix = tone / 255;
        r = Math.round(strokeColor.r + (255 - strokeColor.r) * mix);
        g = Math.round(strokeColor.g + (255 - strokeColor.g) * mix);
        b = Math.round(strokeColor.b + (255 - strokeColor.b) * mix);
      }
      bucket = { style: 'rgba(' + r + ',' + g + ',' + b + ',' + qa.toFixed(3) + ')', dots: [] };
      sub.set(key, bucket);
    }
    bucket.dots.push(x, y, 0.25 + Math.random() * 0.6);
  }
  // Actually draws everything queued for one context since the
  // last flush. Split from paintDot (rather than one flush at the
  // very end of tick()) so updateDrips can flush the fixed
  // canvas's bucket while its own clip against the section's
  // footprint (see updateDrips) is still active—dots queued there
  // must still be drawn under that clip, not after it's already
  // been restored.
  function flushBatch(targetCtx) {
    var sub = batches.get(targetCtx);
    if (!sub || !sub.size) return;
    sub.forEach(function (bucket) {
      targetCtx.fillStyle = bucket.style;
      targetCtx.beginPath();
      var dots = bucket.dots;
      for (var i = 0; i < dots.length; i += 3) {
        // moveTo before each arc—without it, arc() draws a
        // connecting line from the previous dot's edge into this
        // one, and fill() would render that seam too instead of
        // separate circles.
        targetCtx.moveTo(dots[i] + dots[i + 2], dots[i + 1]);
        targetCtx.arc(dots[i], dots[i + 1], dots[i + 2], 0, Math.PI * 2);
      }
      targetCtx.fill();
    });
    sub.clear();
  }

  function stampDot(x, y, alpha) {
    // Touch strokes route to the mobile pane unconditionally--there's no
    // fixed/pane split to reason about on mobile (no sidebar, the whole
    // page scrolls as one), just content-relative-to-window.scrollY
    // storage plus a direct mirror onto the visible slice, same
    // principle as the desktop pane below.
    if (touchArmed) {
      paintDot(mpctx, x, y + window.scrollY, 0, alpha);
      paintDot(mpvctx, x, y, 0, alpha);
      return;
    }
    // Filmstrip membership first: while the Archive lightbox's series
    // filmstrip is open, it visually covers the same screen rectangle
    // the pane's own paneRect occupies (ArchivePreview.vue now nests
    // inside .content-pane, matching the static site)--so without this
    // check first, a dot landing here would fall into the pane branch
    // below and get stored relative to the ARCHIVE GRID's scroll
    // instead of the filmstrip's, decoupled from what's actually on
    // screen. Content-relative to the filmstrip's own scrollLeft, same
    // reasoning as the pane's content-relative-to-scrollTop storage.
    if (filmstripEl && filmstripRect && x >= filmstripRect.left && x <= filmstripRect.right && y >= filmstripRect.top && y <= filmstripRect.bottom) {
      var flocalX = x - filmstripRect.left + filmstripEl.scrollLeft;
      var flocalY = y - filmstripRect.top;
      paintDot(fctx, flocalX, flocalY, 0, alpha);
      paintDot(fvctx, x - filmstripRect.left, y - filmstripRect.top, 0, alpha);
      return;
    }
    // Membership on the pane is horizontal only (left edge, and
    // the right edge stopping short of the scrollbar gutter—see
    // paneRightEdge). Whether a point is ALSO within the
    // currently-visible vertical window (paneRect.top/bottom) is
    // a separate question, checked further down: scattering above
    // the header or below the current bottom fold doesn't mean
    // "not part of the pane," it means "part of the pane, just
    // not visible at this scroll position." Content-relative
    // storage doesn't care which is true—only the direct draw
    // onto the small view canvas does.
    if (paneRect && x >= paneRect.left && x <= paneRightEdge) {
      var g = surfaceTone(x);
      var a = CFG.surfaceAlpha * alpha;
      var lift = edgeLift(x);
      // Off-screen store: content-relative, so it's still there
      // (and correct) the next time blitPane() has to redraw the
      // view canvas from scratch after a scroll.
      var localX = x - (articleRect ? articleRect.left : paneRect.left);
      var localY = y - (articleRect ? articleRect.top : paneRect.top) + lift;
      paintDot(pctx, localX, localY, g, a);
      // Mirror onto the small on-screen view canvas too, but only
      // when this point is actually inside the currently-visible
      // window right now. A dot that scattered above the header
      // or below the current bottom edge is still logically part
      // of the pane (already stored above in content-relative
      // space, at whatever real position that is)—it just isn't
      // part of what's shown this instant. It surfaces on its own
      // via blitPane() the moment scrolling brings that content-Y
      // into paneRect's visible range, instead of either bleeding
      // onto the header/fixed layer or being lost outright.
      if (y >= paneRect.top && y <= paneRect.bottom) {
        paintDot(pvctx, x - paneRect.left, y - paneRect.top + lift, g, a);
      }
    } else if (!(cardRect && x >= cardRect.left && x <= cardRect.right + 10 && y >= cardRect.top && y <= cardRect.bottom + CARD_BOTTOM_MARGIN)) {
      // Outside the pane horizontally (sidebar, or past the
      // scrollbar gutter) and outside the section's footprint
      // entirely: plain paint on the fixed page canvas. (Outside
      // the pane but still within the section—the header, or the
      // scrollbar gutter strip—gets nothing: both sit visually on
      // top of this layer, so there'd be nothing to see anyway.
      // The bottom margin covers the same case just past the
      // section's own bottom-right corner: without it, a dot from
      // a stamp near there that scatters a bit further down than
      // cardRect.bottom counts as "off the section" and lands on
      // the fixed canvas—which stacks above the scrollbar track,
      // so it showed up as paint bleeding through right where the
      // track ends instead of just disappearing like every other
      // dot this close to the card. The +10 on the right catches
      // the same thing one axis over: a scattered dot's x is
      // ordinary float math, and one landing a fraction past
      // cardRect.right on its own no longer matches "within the
      // section" at all, so it skipped the bottom margin above
      // entirely and leaked through right at the corner where
      // both were needed at once.)
      paintDot(ctx, x, y, 0, alpha);
    }
  }

  // One "stamp" = a scattered cluster of dots around (x, y),
  // biased along the direction of travel plus a fixed cap tilt.
  // `spread` (0..1+) widens the cluster—driven by how sharply the
  // path is turning and how slow the cursor is moving. Two
  // populations layer on top of each other: a wide, sparser outer
  // scatter (the textured spray edge) and a tight, near-opaque
  // core scatter right on the centerline (the "heavier toward the
  // middle" bulk of the line)—together they read as a bold, dense
  // fill, not a light mist. The shared radius also carries a
  // slow, persistent wobble (a random walk, not per-dot jitter)
  // so successive stamps aren't identically wide.
  function stamp(x, y, angle, spread) {
    // "Paint over paint": a spot this stroke (or an earlier one)
    // has already crossed several times stamps denser.
    var crossed = (density[cellKey(x, y)] || 0) >= CFG.crossAt;
    var boost = crossed ? CFG.crossBoost : 1;

    widthWobble += (Math.random() - 0.5) * 0.02;
    widthWobble = Math.max(1 - CFG.widthWobbleRange, Math.min(1 + CFG.widthWobbleRange, widthWobble));

    // Counts (not radius or alpha—the line should get sparser
    // under load, not visibly thinner or fainter) scale down with
    // qualityScale when frames are running slow; see tick().
    var outerRadius = (CFG.outerRadiusBase + spread * CFG.outerRadiusSpread) * CFG.outerRadiusMult * widthWobble;
    var outerCount = Math.round((CFG.outerCountBase + spread * CFG.outerCountSpread) * CFG.outerCountMult * boost * qualityScale);
    for (var i = 0; i < outerCount; i++) {
      var a = angle + CFG.capTilt + (Math.random() - 0.5) * 2.6;
      var r = Math.pow(Math.random(), 1.7) * outerRadius;
      stampDot(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55, CFG.dotAlphaOuterMin + Math.random() * CFG.dotAlphaOuterRange);
    }

    var coreRadius = outerRadius * CFG.coreRadiusFrac;
    var coreCount = Math.round((CFG.coreCountBase + spread * CFG.coreCountSpread) * boost * qualityScale);
    for (var j = 0; j < coreCount; j++) {
      var a2 = angle + CFG.capTilt + (Math.random() - 0.5) * 1.5;
      var r2 = Math.pow(Math.random(), 2.6) * coreRadius;
      stampDot(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2 * 0.55, CFG.dotAlphaCoreMin + Math.random() * CFG.dotAlphaCoreRange);
    }

    registerDensity(x, y);
  }

  // A drip is its own slow, independent animation—once triggered
  // it keeps falling frame after frame regardless of where the
  // cursor is now, so it's still crawling down while later
  // tagging happens elsewhere. Path wobbles (a damped random walk,
  // not a clean sine wave—reads as gravity fighting an uneven
  // surface, not a mechanical wiggle) and widens as it falls, so
  // the accumulating trail tapers into a rounded, pear-like tip
  // instead of ending in a hard point. Renders straight to
  // whichever context/color it was assigned at creation (see
  // registerDensity)—not through stampDot, since a pane-space
  // drip's (x, y) are already content-relative, not screen ones.
  function updateDrips() {
    if (!drips.length) return;
    // A fixed-space drip's own random walk can wander into the
    // content pane's screen-space rectangle—including up under its
    // header bar. The whole section is a raised surface (with an
    // opaque header strip on top of it, on project pages) sitting
    // above this layer, so paint drifting under any part of it
    // should disappear behind it, not smear across its face—clip
    // the fixed canvas to everywhere except the section's current
    // footprint for the duration of this update. (Pane-space drips
    // paint on a different canvas entirely, already confined to
    // the scroll container by its own overflow clip.)
    var clipped = false;
    if (cardRect) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width / dpr, canvas.height / dpr);
      // 1px larger than the section's own rect on every side so the
      // clip's own edge antialiasing can't leave a sub-pixel sliver
      // of paint sitting right on the seam—except the right and
      // bottom, both padded out further (10px, and
      // CARD_BOTTOM_MARGIN) so a fixed-space drip that wanders a
      // bit past the section's bottom-right corner still
      // disappears there instead of bleeding onto the fixed
      // canvas, which stacks above the scrollbar track.
      ctx.rect(cardRect.left - 1, cardRect.top - 1, cardRect.width + 11, cardRect.height + 2 + CARD_BOTTOM_MARGIN);
      ctx.clip('evenodd');
      clipped = true;
    }
    // Drips render through paintDot, which reads the module-level
    // strokeColor—swap it to each drip's own captured color for the
    // duration of its paint calls below, restoring afterward so a
    // live stroke elsewhere in the same frame isn't affected.
    var savedStrokeColor = strokeColor;
    for (var i = drips.length - 1; i >= 0; i--) {
      var d = drips[i];
      strokeColor = d.color;
      d.vel += (Math.random() - 0.5) * CFG.dripWobbleAccel;
      d.vel *= CFG.dripWobbleDamp;
      d.x += d.vel;
      var fall = CFG.dripFallMin + Math.random() * CFG.dripFallRange;
      d.y += fall;
      d.dist += fall;

      var targetCtx = d.space === 'pane' ? pctx : (d.space === 'filmstrip' ? fctx : (d.space === 'mobile' ? mpctx : ctx));
      // Same reasoning as stampDot: a pane-space drip's (x, y) are
      // content-relative for persistence, but drawing them AGAIN
      // directly onto the small view canvas whenever they're
      // currently inside the visible window avoids ever needing
      // blitPane()'s expensive full-store copy just because a
      // drip is quietly falling—see stampDot for the measured
      // cost of skipping this.
      var inView = d.space === 'pane' && paneRect && articleRect &&
        (articleRect.top + d.y) >= paneRect.top && (articleRect.top + d.y) <= paneRect.bottom;
      var inFilmstripView = d.space === 'filmstrip' && filmstripEl && filmstripRect;
      var inMobileView = d.space === 'mobile' && (d.y - window.scrollY) >= 0 && (d.y - window.scrollY) <= window.innerHeight;
      var progress = Math.min(1, d.dist / d.maxDist);
      var radius = 1 + progress * 2.6;
      var n = 3 + Math.round(progress * 3);
      for (var k = 0; k < n; k++) {
        var a = d.alphaMul * (0.75 + Math.random() * 0.25);
        var dotX = d.x + (Math.random() - 0.5) * radius;
        var dotY = d.y + (Math.random() - 0.5) * 1.6;
        paintDot(targetCtx, dotX, dotY, d.tone, a);
        if (inView) paintDot(pvctx, articleRect.left + dotX - paneRect.left, articleRect.top + dotY - paneRect.top, d.tone, a);
        if (inFilmstripView) paintDot(fvctx, dotX - filmstripEl.scrollLeft, dotY, d.tone, a);
        if (inMobileView) paintDot(mpvctx, dotX, dotY - window.scrollY, d.tone, a);
      }

      if (d.dist >= d.maxDist) {
        // The bulb: a rounder, denser cluster right at the tip,
        // where a real drop would finally let go.
        for (var b = 0; b < 16; b++) {
          var ang = Math.random() * Math.PI * 2;
          var r = Math.pow(Math.random(), 1.3) * radius * 2;
          var ab = d.alphaMul * (0.8 + Math.random() * 0.2);
          var bx = d.x + Math.cos(ang) * r * 0.7;
          var by = d.y + Math.sin(ang) * r;
          paintDot(targetCtx, bx, by, d.tone, ab);
          if (inView) paintDot(pvctx, articleRect.left + bx - paneRect.left, articleRect.top + by - paneRect.top, d.tone, ab);
          if (inFilmstripView) paintDot(fvctx, bx - filmstripEl.scrollLeft, by, d.tone, ab);
          if (inMobileView) paintDot(mpvctx, bx, by - window.scrollY, d.tone, ab);
        }
        drips.splice(i, 1);
      }
    }
    strokeColor = savedStrokeColor;
    // Flush the fixed-canvas bucket now, while the clip above is
    // still active—these dots must land under it, not after it's
    // been restored below. Off-screen-store and view-canvas drip
    // dots don't need that clip and are left queued for tick()'s
    // own flush.
    flushBatch(ctx);
    if (clipped) ctx.restore();
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    if (!ctrlHeld && !touchArmed) return;

    // Falling behind 30fps (33ms/frame) backs qualityScale off
    // fast; comfortably ahead of it recovers slowly—asymmetric on
    // purpose, so a rough patch reacts immediately but quality
    // doesn't yo-yo back up the moment one fast frame slips in.
    var now = performance.now();
    var frameDt = now - lastFrameTime;
    lastFrameTime = now;
    if (frameDt > 33) {
      qualityScale = Math.max(0.35, qualityScale - 0.06);
    } else if (frameDt < 20) {
      qualityScale = Math.min(1, qualityScale + 0.015);
    }

    // Scrolling the pane while drawing (or while a drip is mid-
    // fall) shifts where "content-relative" coordinates land—
    // keep this current every frame, not just on resize.
    updateArticleRect();

    // Cursor icon: adaptive smoothing—tiny movements (hand
    // tremor, mouse noise) get heavy smoothing so they barely
    // nudge it; real strokes get the snappy factor. Filters
    // micro-jitter without the laggy feel a flat, always-snappy
    // factor produced. Never rotates on its own; it just tilts
    // 7deg left for as long as the mouse button is down, easing
    // back upright the moment it's released.
    var vx = raw.x - smooth.x, vy = raw.y - smooth.y;
    var speed = Math.hypot(vx, vy);
    var lerpT = Math.min(1, speed / CFG.lerpSpeedRef);
    var lerp = CFG.lerpSlow + lerpT * (CFG.lerpFast - CFG.lerpSlow);
    smooth.x += vx * lerp;
    smooth.y += vy * lerp;
    cursor.style.transform = 'translate(' + (raw.x - HOTSPOT_X) + 'px,' + (raw.y - HOTSPOT_Y) + 'px)';
    cursorTilt.style.transform = 'rotate(' + (isDrawing ? -7 : 0) + 'deg)';

    updateDrips();
    // A drip can still be mid-fall on a frame with no active
    // stroke—flush its queued dots now rather than leaving them
    // until the user next draws (they'd otherwise all land at
    // once, several frames late). No blitPane() needed here: any
    // drip dot currently inside the visible window was already
    // drawn straight onto pvctx too (see updateDrips).
    flushBatch(pctx);
    flushBatch(pvctx);
    flushBatch(mpctx);
    flushBatch(mpvctx);

    if (!isDrawing || !lastStamp) return;

    var dxTotal = smooth.x - lastStamp.x;
    var dyTotal = smooth.y - lastStamp.y;
    var dist = Math.hypot(dxTotal, dyTotal);
    var STEP = 3; // px between stamps—dense enough for a solid line at normal speed
    if (dist < STEP) return;

    var angle = Math.atan2(dyTotal, dxTotal);
    var turn = Math.abs(angle - lastAngle);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    var slow = Math.max(0, 1 - dist / 14); // dwelling in place pools more paint
    var spread = Math.min(1.6, turn / 1.4 + slow * 0.6);

    var steps = Math.floor(dist / STEP);
    // A dropped/delayed frame (slow CPU, tab backgrounded a beat)
    // means `dist` can spike huge—stamping every 3px across it
    // would dump hundreds of stamps into one frame and make the
    // next frame even slower. Cap the count and spread it evenly
    // across the same distance instead: the line stays continuous
    // (t still runs 0..1 over the full span below), just a touch
    // thinner for that one recovery frame instead of a stutter.
    if (steps > 40) steps = 40;
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      stamp(lastStamp.x + dxTotal * t, lastStamp.y + dyTotal * t, angle, spread);
    }
    lastStamp = { x: smooth.x, y: smooth.y };
    lastAngle = angle;
    // Same reasoning as above: stampDot already drew straight
    // onto pvctx for anything landing in the visible window, so
    // no blitPane() (and its expensive copy from the full-height
    // off-screen store) is needed just because new stamps were
    // added.
    flushBatch(ctx);
    flushBatch(pctx);
    flushBatch(pvctx);
    flushBatch(fctx);
    flushBatch(fvctx);
    flushBatch(mpctx);
    flushBatch(mpvctx);
  }
  tick();

  // Exposed so other scripts (e.g. the Archive lightbox) can wipe every
  // tag on demand--switching or closing an open Archive card is meant to
  // erase whatever was drawn while it was open, same trigger as Escape.
  window.clearGraffiti = clearAll;

  return function destroy() {
    cancelAnimationFrame(rafId);
    cancelAnimationFrame(scrollWatchRafId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('click', onClick, true);
    if (touchCapable) {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    }
    clearTimeout(longPressTimer);
    if (resizeObserver) resizeObserver.disconnect();
    if (mobileResizeObserver) mobileResizeObserver.disconnect();
    document.body.classList.remove('graffiti-mode');
    if (window.clearGraffiti === clearAll) delete window.clearGraffiti;
    canvas.remove();
    paneView.remove();
    filmstripView.remove();
    mobilePaneView.remove();
    cursor.remove();
  };
};
